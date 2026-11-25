import { useCallback, useEffect, useState } from 'react';
import type { AccountEntry, Balance, LedgerClient } from './api/types';

export interface LedgerState {
  balance: Balance | null;
  entries: AccountEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface Snapshot {
  balance: Balance | null;
  entries: AccountEntry[];
  error: string | null;
}

async function loadSnapshot(client: LedgerClient, accountId: string): Promise<Snapshot> {
  try {
    const [balance, page] = await Promise.all([client.getBalance(accountId), client.listTransactions(accountId, { limit: 50 })]);
    return { balance, entries: page.items, error: null };
  } catch (err) {
    return { balance: null, entries: [], error: err instanceof Error ? err.message : 'Could not load account' };
  }
}

/** Balance + recent statement rows for one account. */
export function useLedger(client: LedgerClient, accountId: string): LedgerState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot(client, accountId).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [client, accountId]);

  const refresh = useCallback(async () => {
    const next = await loadSnapshot(client, accountId);
    // Keep showing the last good data if a refresh fails.
    setSnapshot((prev) => (next.error && prev ? { ...prev, error: next.error } : next));
  }, [client, accountId]);

  return {
    balance: snapshot?.balance ?? null,
    entries: snapshot?.entries ?? [],
    loading: snapshot === null,
    error: snapshot?.error ?? null,
    refresh,
  };
}

export function newIdempotencyKey(): string {
  return `web-${crypto.randomUUID()}`;
}
