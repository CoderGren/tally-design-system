import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'Components/Select',
  component: Select,
  args: {
    label: 'To account',
    placeholder: 'Choose an account',
    defaultValue: '',
    options: [
      { value: 'ops', label: 'Operations ••4821' },
      { value: 'tax', label: 'Tax reserve ••1180' },
      { value: 'payroll', label: 'Payroll ••7702 (frozen)', disabled: true },
    ],
  },
  decorators: [(Story) => <div style={{ maxWidth: 360 }}><Story /></div>],
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithError: Story = { args: { error: 'Choose a destination account' } };
