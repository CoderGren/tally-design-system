import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: { label: 'Memo', placeholder: 'What is this for?' },
  decorators: [(Story) => <div style={{ maxWidth: 360 }}><Story /></div>],
} satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: 'Appears on both statements' } };
export const WithError: Story = { args: { defaultValue: 'x'.repeat(150), error: 'Use 140 characters or fewer' } };
export const Required: Story = { args: { label: 'Account name', required: true } };
export const WithAdornments: Story = { args: { label: 'Routing number', prefix: '#', suffix: '9 digits', inputMode: 'numeric' } };
