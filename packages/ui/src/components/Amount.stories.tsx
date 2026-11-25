import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from './Amount';

const meta = {
  title: 'Components/Amount',
  component: Amount,
  args: { cents: 123456, currency: 'USD', locale: 'en-US' },
} satisfies Meta<typeof Amount>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Credit: Story = { args: { cents: 2500, signed: true } };
export const Debit: Story = { args: { cents: -2500, signed: true } };
export const Large: Story = { args: { cents: 8_423_150, size: 'xl' } };
export const Euro: Story = { args: { currency: 'EUR', locale: 'de-DE' } };
