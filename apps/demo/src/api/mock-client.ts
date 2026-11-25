import { LedgerApiError, type AccountEntry, type Balance, type Currency, type LedgerClient, type Transaction, type TransferInput } from './types';

export interface MockAccount {
  id: string;
  name: string;
  /** Funding/clearing accounts may go negative, like in the real ledger. */
  allowNegative?: boolean;
  /** Defaults to USD. Transfers must stay within one currency, like the real API. */
  currency?: Currency;
}

/**
 * In-browser ledger with the same rules as the real API: double entry, integer cents,
 * no overdrafts on customer accounts, idempotency keys, single reversal.
 */
export function createMockLedgerClient(seed: { accounts: MockAccount[]; history?: TransferInput[]; now?: () => Date; latencyMs?: number }): LedgerClient {
  const accounts = new Map(seed.accounts.map((a) => [a.id, { ...a, currency: a.currency ?? ('USD' as Currency), balanceCents: 0 }]));
  const transactions = new Map<string, Transaction>();
  const entries: AccountEntry[] = [];
  const idempotency = new Map<string, { fingerprint: string; transactionId: string }>();
  const reversed = new Set<string>();
  const clock = seed.now ?? (() => new Date());
  let override: Date | null = null;
  const now = () => override ?? clock();
  let seq = 0;
  const delay = () => new Promise((r) => setTimeout(r, seed.latencyMs ?? 0));

  function post(kind: Transaction['kind'], legs: Array<{ accountId: string; amountCents: number }>, key: string, memo?: string, reverses?: string): Transaction {
    const currency = accounts.get(legs[0]!.accountId)?.currency ?? 'USD';
    for (const leg of legs) {
      const a = accounts.get(leg.accountId);
      if (!a) throw new LedgerApiError(404, 'NOT_FOUND', `account ${leg.accountId} not found`);
      if (a.currency !== currency) throw new LedgerApiError(422, 'CURRENCY_MISMATCH', 'accounts use different currencies');
      if (a.balanceCents + leg.amountCents < 0 && !a.allowNegative) {
        throw new LedgerApiError(422, 'INSUFFICIENT_FUNDS', `${a.name} has insufficient funds`);
      }
    }
    const txn: Transaction = {
      id: `mock-${String(++seq).padStart(5, '0')}`,
      kind,
      currency,
      entries: legs,
      createdAt: now().toISOString(),
      idempotencyKey: key,
      ...(memo ? { memo } : {}),
      ...(reverses ? { reversesTransactionId: reverses } : {}),
    };
    for (const [i, leg] of legs.entries()) {
      accounts.get(leg.accountId)!.balanceCents += leg.amountCents;
      entries.unshift({
        transactionId: txn.id,
        accountId: leg.accountId,
        counterpartyAccountId: legs[(i + 1) % legs.length]!.accountId,
        kind,
        amountCents: leg.amountCents,
        currency,
        createdAt: txn.createdAt,
        ...(memo ? { memo } : {}),
        ...(reverses ? { reversesTransactionId: reverses } : {}),
      });
    }
    transactions.set(txn.id, txn);
    if (reverses) reversed.add(reverses);
    return txn;
  }

  function withIdempotency(key: string, fingerprint: string, run: () => Transaction): Transaction {
    if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) throw new LedgerApiError(400, 'VALIDATION', 'invalid Idempotency-Key');
    const prior = idempotency.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new LedgerApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key reused');
      return transactions.get(prior.transactionId)!;
    }
    const txn = run();
    idempotency.set(key, { fingerprint, transactionId: txn.id });
    return txn;
  }

  const transfer = (input: TransferInput, key: string) =>
    withIdempotency(key, JSON.stringify(['t', input.fromAccountId, input.toAccountId, input.amountCents, input.memo ?? '']), () => {
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
        throw new LedgerApiError(400, 'VALIDATION', 'amountCents must be a positive integer');
      }
      if (input.fromAccountId === input.toAccountId) throw new LedgerApiError(400, 'VALIDATION', 'accounts must differ');
      return post(
        'transfer',
        [
          { accountId: input.fromAccountId, amountCents: -input.amountCents },
          { accountId: input.toAccountId, amountCents: input.amountCents },
        ],
        key,
        input.memo,
      );
    });

  // Replay seed history through the same rules so the mock is always internally consistent.
  // Seed history is spread over the preceding days so the statement looks realistic.
  const history = seed.history ?? [];
  for (const [i, h] of history.entries()) {
    override = new Date(clock().getTime() - (history.length - i) * 3 * 86_400_000);
    transfer(h, `seed-history-${i}`);
  }
  override = null;

  return {
    mode: 'mock',
    async getBalance(accountId): Promise<Balance> {
      await delay();
      const a = accounts.get(accountId);
      if (!a) throw new LedgerApiError(404, 'NOT_FOUND', `account ${accountId} not found`);
      return { accountId: a.id, name: a.name, currency: a.currency, balanceCents: a.balanceCents };
    },
    async listTransactions(accountId, { limit = 25, cursor } = {}) {
      await delay();
      if (!accounts.has(accountId)) throw new LedgerApiError(404, 'NOT_FOUND', `account ${accountId} not found`);
      const all = entries.filter((e) => e.accountId === accountId);
      const start = cursor ? Number(cursor) : 0;
      const items = all.slice(start, start + limit);
      return start + limit < all.length ? { items, nextCursor: String(start + limit) } : { items };
    },
    async postTransfer(input, key) {
      await delay();
      return transfer(input, key);
    },
    async reverseTransaction(transactionId, key) {
      await delay();
      return withIdempotency(key, JSON.stringify(['r', transactionId]), () => {
        const original = transactions.get(transactionId);
        if (!original) throw new LedgerApiError(404, 'NOT_FOUND', 'transaction not found');
        if (original.kind === 'reversal') throw new LedgerApiError(400, 'VALIDATION', 'a reversal cannot be reversed');
        if (reversed.has(transactionId)) throw new LedgerApiError(409, 'ALREADY_REVERSED', 'transaction already reversed');
        return post(
          'reversal',
          original.entries.map((e) => ({ accountId: e.accountId, amountCents: -e.amountCents })),
          key,
          `Reversal of ${original.id}`,
          transactionId,
        );
      });
    },
  };
}
