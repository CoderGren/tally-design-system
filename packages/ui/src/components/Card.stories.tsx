import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from './Amount';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  args: { title: 'Operating account', description: 'Checking ••4821' },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Balance: Story = {
  args: {
    actions: <Button size="sm" variant="secondary">Statements</Button>,
    children: (
      <div style={{ display: 'grid', gap: 8 }}>
        <Amount cents={8_423_150} size="xl" />
        <div><Badge tone="positive">+4.2% this month</Badge></div>
      </div>
    ),
  },
};
export const Plain: Story = { args: { title: undefined, description: undefined, children: 'A card without a header.' } };
