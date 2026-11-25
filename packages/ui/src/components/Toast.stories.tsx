import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { ToastProvider } from './Toast';
import { useToast } from './toast-context';

function Triggers() {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onClick={() => toast.show({ title: 'Transfer sent', description: '$2,500.00 to Tax reserve', tone: 'positive' })}>Success</Button>
      <Button variant="secondary" onClick={() => toast.show({ title: 'Statement ready', description: 'November 2026' })}>Info</Button>
      <Button variant="danger" onClick={() => toast.show({ title: 'Transfer failed', description: 'Insufficient funds', tone: 'negative', duration: 0 })}>
        Error
      </Button>
    </div>
  );
}

function Demo() {
  return (
    <ToastProvider>
      <Triggers />
    </ToastProvider>
  );
}

const meta = {
  title: 'Components/Toast',
  component: Demo,
  parameters: {
    docs: {
      description: {
        component: 'Success and info toasts use a polite status region; errors use role="alert" and stay until dismissed.',
      },
    },
  },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
