import { Amount, Badge, Card, sumCents } from '@tally/ui';
import type { AccountEntry, Balance } from '../api/types';

export function BalanceCard({ balance, entries, loading }: { balance: Balance | null; entries: AccountEntry[]; loading: boolean }) {
  const inflow = sumCents(entries.filter((e) => e.amountCents > 0).map((e) => e.amountCents));
  const outflow = sumCents(entries.filter((e) => e.amountCents < 0).map((e) => e.amountCents));
  const currency = balance?.currency;
  return (
    <Card title="Available balance" description={balance?.name ?? 'Loading account'} className="demo-balance">
      <div aria-live="polite" aria-busy={loading}>
        {balance ? <Amount cents={balance.balanceCents} currency={balance.currency} size="xl" /> : <span className="demo-skeleton">Loading…</span>}
      </div>
      <dl className="demo-flows">
        <div>
          <dt>Money in</dt>
          <dd>
            {currency ? <Amount cents={inflow} currency={currency} signed /> : null}
          </dd>
        </div>
        <div>
          <dt>Money out</dt>
          <dd>
            {currency ? <Amount cents={outflow} currency={currency} signed /> : null}
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
