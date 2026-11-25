import { createHttpLedgerClient } from './http-client';
import { createMockLedgerClient } from './mock-client';
import { withMockFallback } from './resilient-client';
import type { Currency, LedgerClient } from './types';

export interface AccountOption {
  id: string;
  name: string;
}

export interface DemoConfig {
  client: LedgerClient;
  primary: AccountOption;
  counterparties: AccountOption[];
}

export const DEFAULT_PRIMARY: AccountOption = { id: 'operating', name: 'Operating ••4821' };
export const DEFAULT_COUNTERPARTIES: AccountOption[] = [
  { id: 'tax-reserve', name: 'Tax reserve ••1180' },
  { id: 'payroll', name: 'Payroll ••7702' },
  { id: 'vendor-cloud', name: 'Cloud hosting vendor' },
];

/**
 * Mock ledger seeded with the same account ids the UI is configured with, so the start-up
 * fallback (API configured but not reachable) still renders. History is replayed through the
 * ledger rules.
 */
export function createMockClient(primary: AccountOption, counterparties: AccountOption[], latencyMs = 250, currency: Currency = 'USD'): LedgerClient {
  const [first, second, third] = counterparties;
  const history = [
    { fromAccountId: 'funding', toAccountId: primary.id, amountCents: 12_500_000, memo: 'Seed round tranche' },
    { fromAccountId: 'funding', toAccountId: primary.id, amountCents: 1_250_000, memo: 'Customer invoice #1042' },
    ...(second ? [{ fromAccountId: primary.id, toAccountId: second.id, amountCents: 3_200_000, memo: 'November payroll' }] : []),
    ...(third ? [{ fromAccountId: primary.id, toAccountId: third.id, amountCents: 48_213, memo: 'Cloud hosting' }] : []),
    ...(first ? [{ fromAccountId: primary.id, toAccountId: first.id, amountCents: 1_000_000, memo: 'Quarterly tax set-aside' }] : []),
    { fromAccountId: 'funding', toAccountId: primary.id, amountCents: 389_950, memo: 'Customer invoice #1043' },
  ];
  return createMockLedgerClient({
    accounts: [{ id: 'funding', name: 'Incoming wires', allowNegative: true }, primary, ...counterparties].map((a) => ({ ...a, currency })),
    history,
    latencyMs,
  });
}

function parseAccounts(raw: string | undefined): AccountOption[] {
  return (raw ?? '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id = '', ...name] = pair.split(':');
      return { id: id.trim(), name: name.join(':').trim() || id.trim() };
    });
}

/**
 * Mock data by default. The live API is used only when VITE_USE_LIVE_API=true AND the API URL and
 * account ids are set; even then, the mock is only a start-up fallback for reads (see
 * withMockFallback). A public demo build should simply never set VITE_USE_LIVE_API.
 */
export function loadDemoConfig(
  env: Record<string, string | undefined>,
  onFallback: (reason: unknown) => void,
  latencyMs = 250,
): DemoConfig {
  const apiUrl = env.VITE_LEDGER_API_URL;
  const primaryId = env.VITE_PRIMARY_ACCOUNT_ID;
  const counterparties = parseAccounts(env.VITE_COUNTERPARTY_ACCOUNTS);
  const wantsLive = env.VITE_USE_LIVE_API === 'true';
  if (!wantsLive || !apiUrl || !primaryId || counterparties.length === 0) {
    return { client: createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, latencyMs), primary: DEFAULT_PRIMARY, counterparties: DEFAULT_COUNTERPARTIES };
  }
  const primary = { id: primaryId, name: env.VITE_PRIMARY_ACCOUNT_NAME ?? 'Operating' };
  const client = withMockFallback(
    createHttpLedgerClient({ baseUrl: apiUrl }),
    createMockClient(primary, counterparties, latencyMs),
    onFallback,
  );
  return { client, primary, counterparties };
}
