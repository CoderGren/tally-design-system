import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { formatCents } from '../money/money';
import { MoneyInput, type MoneyInputProps } from './MoneyInput';

function Controlled(props: Omit<MoneyInputProps, 'valueCents' | 'onValueChange'> & { initialCents?: number | null }) {
  const { initialCents = null, ...rest } = props;
  const [cents, setCents] = useState<number | null>(initialCents);
  return (
    <div style={{ maxWidth: 320, display: 'grid', gap: 12 }}>
      <MoneyInput {...rest} valueCents={cents} onValueChange={setCents} />
      <code style={{ color: 'var(--tally-color-text-muted)' }}>
        valueCents = {String(cents)}
        {cents !== null && ` (${formatCents(cents, { currency: rest.currency ?? 'USD', locale: rest.locale })})`}
      </code>
    </div>
  );
}

const meta = {
  title: 'Components/MoneyInput',
  component: Controlled,
  args: { label: 'Amount', currency: 'USD', locale: 'en-US' },
  parameters: {
    docs: {
      description: {
        component:
          'Reports integer minor units only. Parsing is string/BigInt based and never rounds: `10.999` is an error, not `$11.00`.',
      },
    },
  },
} satisfies Meta<typeof Controlled>;
export default meta;
type Story = StoryObj<typeof meta>;

export const USD: Story = { args: { initialCents: 123456 } };
export const Empty: Story = {};
export const Euro_German: Story = { args: { currency: 'EUR', locale: 'de-DE', initialCents: 99950 } };
export const Yen: Story = { args: { currency: 'JPY', locale: 'ja-JP', initialCents: 15000 } };
export const WithLimits: Story = { args: { label: 'Transfer amount', minCents: 100, maxCents: 2_500_000, hint: 'Between $1.00 and $25,000.00' } };
