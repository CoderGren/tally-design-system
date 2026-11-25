import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

function Demo({ role }: { role?: 'dialog' | 'alertdialog' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Review transfer</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        role={role}
        title="Confirm transfer"
        description="$2,500.00 from Operating ••4821 to Tax reserve ••1180"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Send $2,500.00</Button>
          </>
        }
      >
        Transfers between your own accounts arrive instantly and can be reversed from the transaction list.
      </Dialog>
    </>
  );
}

const meta = {
  title: 'Components/Dialog',
  component: Demo,
  parameters: {
    docs: { description: { component: 'Focus is trapped while open, Escape closes, and focus returns to the trigger.' } },
  },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AlertDialog: Story = { args: { role: 'alertdialog' } };
