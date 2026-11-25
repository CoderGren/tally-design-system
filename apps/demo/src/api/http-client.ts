import { LedgerApiError, LedgerUnreachableError, type AccountEntry, type Balance, type LedgerClient, type Page, type Transaction, type TransferInput } from './types';

export interface HttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Bearer token for a ledger API behind its JWT authorizer. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
}

/** Typed fetch client for the ledger API. */
export function createHttpLedgerClient({ baseUrl, fetch: fetchImpl = globalThis.fetch.bind(globalThis), timeoutMs = 8000, getAccessToken }: HttpClientOptions): LedgerClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(method: 'GET' | 'POST', path: string, opts: { body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey;
    const token = await getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Network failure or timeout: for a POST the server may still have committed it.
      throw new LedgerUnreachableError(`${method} ${path} did not complete`, { cause: err });
    }
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new LedgerApiError(res.status, (err?.code as LedgerApiError['code']) ?? 'INTERNAL', err?.message ?? `HTTP ${res.status}`);
    }
    return payload as T;
  }

  const enc = encodeURIComponent;
  return {
    mode: 'live',
    getBalance: (accountId) => request<Balance>('GET', `/accounts/${enc(accountId)}/balance`),
    listTransactions: (accountId, { limit = 25, cursor } = {}) => {
      const qs = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
      return request<Page<AccountEntry>>('GET', `/accounts/${enc(accountId)}/transactions?${qs}`);
    },
    postTransfer: (input: TransferInput, idempotencyKey) => request<Transaction>('POST', '/transfers', { body: input, idempotencyKey }),
    reverseTransaction: (transactionId, idempotencyKey) =>
      request<Transaction>('POST', `/transactions/${enc(transactionId)}/reversal`, { body: {}, idempotencyKey }),
  };
}
