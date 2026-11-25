import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Posted', tone: 'positive' },
  argTypes: { tone: { control: 'inline-radio', options: ['neutral', 'positive', 'negative', 'warning', 'accent'] } },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Positive: Story = {};
export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge tone="neutral">Reversed</Badge>
      <Badge tone="positive">Posted</Badge>
      <Badge tone="warning">Pending</Badge>
      <Badge tone="negative">Failed</Badge>
      <Badge tone="accent">New</Badge>
    </div>
  ),
};
