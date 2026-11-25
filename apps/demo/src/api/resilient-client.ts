import { LedgerUnreachableError, type LedgerClient } from './types';

/**
 * Live API with a one-way, read-only fallback to the mock:
 *
 * - Only an unreachable API on a READ, before any live call has succeeded, switches to the mock.
 *   That covers "the demo was configured for an API that isn't running".
 * - Writes never fall back. A timed-out transfer may have committed on the server, so it throws
 *   `LedgerUnreachableError` and the UI retries with the same idempotency key.
 * - Once live data has been shown, nothing falls back: the dashboard would otherwise mix real
 *   and invented balances.
 * - The switch is sticky; going back to live needs a reload.
 */
export function withMockFallback(live: LedgerClient, mock: LedgerClient, onFallback: (reason: unknown) => void): LedgerClient {
  let active: LedgerClient = live;
  let liveConfirmed = false;

  const read =
    <A extends unknown[], R>(pick: (c: LedgerClient) => (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (active === mock) return pick(mock)(...args);
      try {
        const result = await pick(live)(...args);
        liveConfirmed = true;
        return result;
      } catch (err) {
        if (liveConfirmed || !(err instanceof LedgerUnreachableError)) throw err;
        active = mock;
        onFallback(err);
        return pick(mock)(...args);
      }
    };

  const write =
    <A extends unknown[], R>(pick: (c: LedgerClient) => (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (active === mock) return pick(mock)(...args);
      const result = await pick(live)(...args);
      liveConfirmed = true;
      return result;
    };

  return {
    get mode() {
      return active.mode;
    },
    getBalance: read((c) => c.getBalance),
    listTransactions: read((c) => c.listTransactions),
    postTransfer: write((c) => c.postTransfer),
    reverseTransaction: write((c) => c.reverseTransaction),
  };
}
