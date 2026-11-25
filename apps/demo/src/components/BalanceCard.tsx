import { Amount, Badge, Card } from '@tally/ui';
import type { AccountEntry, Balance } from '../api/types';

export function BalanceCard({ balance, entries, loading }: { balance: Balance | null; entries: AccountEntry[]; loading: boolean }) {
  const inflow = entries.filter((e) => e.amountCents > 0).reduce((s, e) => s + e.amountCents, 0);
  const outflow = entries.filter((e) => e.amountCents < 0).reduce((s, e) => s + e.amountCents, 0);
  return (
    <Card title="Available balance" description={balance?.name ?? 'Loading account'} className="demo-balance">
      <div aria-live="polite" aria-busy={loading}>
        {balance ? <Amount cents={balance.balanceCents} currency={balance.currency} size="xl" /> : <span className="demo-skeleton">Loading…</span>}
      </div>
      <dl className="demo-flows">
        <div>
          <dt>Money in</dt>
          <dd>
            <Amount cents={inflow} signed />
          </dd>
        </div>
        <div>
          <dt>Money out</dt>
          <dd>
            <Amount cents={outflow} signed />
          </dd>
        </div>
        <div>
          <dt>Transactions</dt>
          <dd>
            <Badge tone="neutral">{entries.length}</Badge>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
