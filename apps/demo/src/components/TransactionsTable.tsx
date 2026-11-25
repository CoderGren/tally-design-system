import { Amount, Badge, Button, Card, Table, type TableColumn } from '@tally/ui';
import type { AccountEntry } from '../api/types';

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export interface TransactionsTableProps {
  entries: AccountEntry[];
  accountName: (id: string) => string;
  reversedIds: Set<string>;
  onReverse: (entry: AccountEntry) => void;
}

export function TransactionsTable({ entries, accountName, reversedIds, onReverse }: TransactionsTableProps) {
  const columns: TableColumn<AccountEntry>[] = [
    { key: 'date', header: 'Date', sortValue: (e) => e.createdAt, cell: (e) => dateFormat.format(new Date(e.createdAt)) },
    { key: 'memo', header: 'Description', rowHeader: true, sortValue: (e) => e.memo ?? '', cell: (e) => e.memo ?? 'Transfer' },
    { key: 'counterparty', header: 'Counterparty', sortValue: (e) => accountName(e.counterpartyAccountId), cell: (e) => accountName(e.counterpartyAccountId) },
    {
      key: 'status',
      header: 'Status',
      cell: (e) =>
        e.kind === 'reversal' ? (
          <Badge tone="warning">Reversal</Badge>
        ) : reversedIds.has(e.transactionId) ? (
          <Badge tone="neutral">Reversed</Badge>
        ) : (
          <Badge tone="positive">Posted</Badge>
        ),
    },
    { key: 'amount', header: 'Amount', align: 'end', sortValue: (e) => e.amountCents, cell: (e) => <Amount cents={e.amountCents} currency={e.currency} signed /> },
    {
      key: 'actions',
      header: <span className="tally-visually-hidden">Actions</span>,
      align: 'end',
      cell: (e) =>
        e.kind === 'transfer' && !reversedIds.has(e.transactionId) ? (
          <Button size="sm" variant="ghost" onClick={() => onReverse(e)} aria-label={`Reverse ${e.memo ?? 'transfer'}`}>
            Reverse
          </Button>
        ) : null,
    },
  ];

  return (
    <Card title="Transactions" description="Newest first. Sort by any column.">
      <Table
        caption="Account transactions"
        hideCaption
        columns={columns}
        rows={entries}
        getRowKey={(e) => `${e.transactionId}-${e.accountId}`}
        initialSort={{ key: 'date', direction: 'descending' }}
        emptyState="No transactions yet"
      />
    </Card>
  );
}
