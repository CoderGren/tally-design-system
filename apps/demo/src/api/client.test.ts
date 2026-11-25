import { describe, expect, it, vi } from 'vitest';
import { createMockClient, DEFAULT_COUNTERPARTIES, DEFAULT_PRIMARY, loadDemoConfig } from './config';
import { createHttpLedgerClient } from './http-client';
import { withMockFallback } from './resilient-client';
import { LedgerApiError, LedgerUnreachableError, isOutcomeUnknown } from './types';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('HTTP ledger client', () => {
  it('sends typed requests with the idempotency key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(201, { id: 't1', kind: 'transfer' }));
    const client = createHttpLedgerClient({ baseUrl: 'https://api.example.test/', fetch });
    const txn = await client.postTransfer({ fromAccountId: 'a', toAccountId: 'b', amountCents: 2500 }, 'web-key-123');
    expect(txn.id).toBe('t1');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.example.test/transfers');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['idempotency-key']).toBe('web-key-123');
    expect(JSON.parse(init?.body as string)).toEqual({ fromAccountId: 'a', toAccountId: 'b', amountCents: 2500 });
  });

  it('encodes path segments and query params', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, { items: [] }));
    await createHttpLedgerClient({ baseUrl: 'https://x.test', fetch }).listTransactions('a/b', { limit: 10, cursor: 'c=1' });
    expect(fetch.mock.calls[0]![0]).toBe('https://x.test/accounts/a%2Fb/transactions?limit=10&cursor=c%3D1');
  });

  it('turns API error bodies into LedgerApiError', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(422, { error: { code: 'INSUFFICIENT_FUNDS', message: 'nope' } }));
    const err = await createHttpLedgerClient({ baseUrl: 'https://x.test', fetch }).getBalance('a').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LedgerApiError);
    expect(err).toMatchObject({ status: 422, code: 'INSUFFICIENT_FUNDS', message: 'nope' });
  });
});

describe('mock ledger', () => {
  const mock = () => createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0);

  it('seeds a consistent history', async () => {
    const client = mock();
    const balance = await client.getBalance('operating');
    // 125,000.00 + 12,500.00 - 32,000.00 - 482.13 - 10,000.00 + 3,899.50
    expect(balance.balanceCents).toBe(9_891_737);
    const { items } = await client.listTransactions('operating');
    expect(items.reduce((s, e) => s + e.amountCents, 0)).toBe(balance.balanceCents);
  });

  it('enforces overdraft, idempotency and single reversal rules', async () => {
    const client = mock();
    await expect(client.postTransfer({ fromAccountId: 'payroll', toAccountId: 'operating', amountCents: 999_999_999 }, 'key-00000001')).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });
    const input = { fromAccountId: 'operating', toAccountId: 'payroll', amountCents: 100 };
    const a = await client.postTransfer(input, 'key-00000002');
    const b = await client.postTransfer(input, 'key-00000002');
    expect(b.id).toBe(a.id);
    await expect(client.postTransfer({ ...input, amountCents: 200 }, 'key-00000002')).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await client.reverseTransaction(a.id, 'key-00000003');
    await expect(client.reverseTransaction(a.id, 'key-00000004')).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
  });
});

describe('mock fallback', () => {
  it('switches to the mock when the API is unreachable, but not on API errors', async () => {
    const onFallback = vi.fn();
    const unreachable = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = withMockFallback(createHttpLedgerClient({ baseUrl: 'https://down.test', fetch: unreachable }), createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0), onFallback);
    expect(client.mode).toBe('live');
    const balance = await client.getBalance('operating');
    expect(balance.name).toBe(DEFAULT_PRIMARY.name);
    expect(client.mode).toBe('mock');
    expect(onFallback).toHaveBeenCalledOnce();

    const rejecting = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    const strict = withMockFallback(createHttpLedgerClient({ baseUrl: 'https://up.test', fetch: rejecting }), createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0), onFallback);
    await expect(strict.getBalance('operating')).rejects.toBeInstanceOf(LedgerApiError);
    expect(strict.mode).toBe('live');
  });

  it('D-M1: a write that times out throws LedgerUnreachableError and never touches the mock', async () => {
    const onFallback = vi.fn();
    const mock = createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0);
    const mockPost = vi.spyOn(mock, 'postTransfer');
    const mockReverse = vi.spyOn(mock, 'reverseTransaction');
    const timeout = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    const client = withMockFallback(createHttpLedgerClient({ baseUrl: 'https://slow.test', fetch: timeout }), mock, onFallback);
    const input = { fromAccountId: 'operating', toAccountId: 'payroll', amountCents: 100 };
    await expect(client.postTransfer(input, 'key-timeout-1')).rejects.toBeInstanceOf(LedgerUnreachableError);
    await expect(client.reverseTransaction('t1', 'key-timeout-2')).rejects.toBeInstanceOf(LedgerUnreachableError);
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockReverse).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
    expect(client.mode).toBe('live');
  });

  it('D-M1: after the first successful live call, an unreachable read throws instead of switching', async () => {
    const onFallback = vi.fn();
    const fetchImpl = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(jsonResponse(200, { accountId: 'operating', name: 'Live', currency: 'USD', balanceCents: 5 }))
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const client = withMockFallback(createHttpLedgerClient({ baseUrl: 'https://flaky.test', fetch: fetchImpl }), createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0), onFallback);
    expect((await client.getBalance('operating')).name).toBe('Live');
    await expect(client.getBalance('operating')).rejects.toBeInstanceOf(LedgerUnreachableError);
    expect(client.mode).toBe('live');
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('classifies which failures leave a write outcome unknown', () => {
    expect(isOutcomeUnknown(new LedgerUnreachableError('x'))).toBe(true);
    expect(isOutcomeUnknown(new LedgerApiError(502, 'INTERNAL', 'bad gateway'))).toBe(true);
    expect(isOutcomeUnknown(new LedgerApiError(409, 'CONCURRENT_UPDATE', 'race'))).toBe(true);
    expect(isOutcomeUnknown(new LedgerApiError(422, 'INSUFFICIENT_FUNDS', 'no'))).toBe(false);
    expect(isOutcomeUnknown(new LedgerApiError(409, 'IDEMPOTENCY_CONFLICT', 'no'))).toBe(false);
  });

  it('sends a bearer token when one is available', async () => {
    const fetchImpl = vi.fn<typeof globalThis.fetch>().mockResolvedValue(jsonResponse(200, { accountId: 'a', name: 'A', currency: 'USD', balanceCents: 0 }));
    await createHttpLedgerClient({ baseUrl: 'https://api.test', fetch: fetchImpl, getAccessToken: () => 'tok' }).getBalance('a');
    expect((fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('defaults to mock data; live needs VITE_USE_LIVE_API=true plus the URL and accounts', () => {
    expect(loadDemoConfig({}, vi.fn()).client.mode).toBe('mock');
    const env = { VITE_LEDGER_API_URL: 'https://api.example.test', VITE_PRIMARY_ACCOUNT_ID: 'acc-1', VITE_COUNTERPARTY_ACCOUNTS: 'acc-2:Tax, acc-3' };
    expect(loadDemoConfig(env, vi.fn()).client.mode).toBe('mock');
    const cfg = loadDemoConfig({ ...env, VITE_USE_LIVE_API: 'true' }, vi.fn());
    expect(cfg.client.mode).toBe('live');
    expect(cfg.counterparties).toEqual([
      { id: 'acc-2', name: 'Tax' },
      { id: 'acc-3', name: 'acc-3' },
    ]);
  });
});
