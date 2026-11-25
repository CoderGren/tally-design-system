import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from './Amount';
import { Badge } from './Badge';
import { Table, type TableColumn } from './Table';

interface Txn {
  id: string;
  date: string;
  description: string;
  status: 'posted' | 'pending' | 'reversed';
  cents: number;
}

const rows: Txn[] = [
  { id: 't1', date: '2026-11-20', description: 'Acme Corp invoice #1042', status: 'posted', cents: 1_250_000 },
  { id: 't2', date: '2026-11-19', description: 'Cloud hosting', status: 'posted', cents: -48_213 },
  { id: 't3', date: '2026-11-18', description: 'Payroll', status: 'pending', cents: -3_200_000 },
  { id: 't4', date: '2026-11-15', description: 'Office supplies', status: 'reversed', cents: -12_999 },
];

const tone = { posted: 'positive', pending: 'warning', reversed: 'neutral' } as const;

const columns: TableColumn<Txn>[] = [
  { key: 'date', header: 'Date', sortValue: (r) => r.date },
  { key: 'description', header: 'Description', sortValue: (r) => r.description, rowHeader: true },
  { key: 'status', header: 'Status', cell: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
  { key: 'amount', header: 'Amount', align: 'end', sortValue: (r) => r.cents, cell: (r) => <Amount cents={r.cents} signed /> },
];

const meta = {
  title: 'Components/Table',
  component: Table<Txn>,
  args: { caption: 'Recent transactions', columns, rows, getRowKey: (r: Txn) => r.id },
} satisfies Meta<typeof Table<Txn>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sortable: Story = { args: { initialSort: { key: 'date', direction: 'descending' } } };
export const Compact: Story = { args: { density: 'compact' } };
export const Empty: Story = { args: { rows: [], emptyState: 'No transactions yet' } };
