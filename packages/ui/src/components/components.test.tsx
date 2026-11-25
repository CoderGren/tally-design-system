import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe';
import { Amount } from './Amount';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Dialog } from './Dialog';
import { MoneyInput } from './MoneyInput';
import { Select } from './Select';
import { Table, type TableColumn } from './Table';
import { TextField } from './TextField';
import { ToastProvider } from './Toast';
import { useToast } from './toast-context';

describe('Button', () => {
  it('fires clicks and is accessible', async () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>Send money</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Send money' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('blocks clicks and announces busy state while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Plain</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('TextField', () => {
  it('links label, hint and error to the input', async () => {
    const { container } = render(<TextField label="Memo" hint="Shown on the statement" error="Too long" />);
    const input = screen.getByRole('textbox', { name: 'Memo' });
    expect(input).toHaveAccessibleDescription('Shown on the statement Too long');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Too long');
    expect(await axeViolations(container)).toEqual([]);
  });
});

function ControlledMoney(props: { locale?: string; currency?: string; onCents?: (c: number | null) => void; initial?: number | null }) {
  const [cents, setCents] = useState<number | null>(props.initial ?? null);
  return (
    <>
      <MoneyInput
        label="Amount"
        valueCents={cents}
        currency={props.currency}
        locale={props.locale}
        onValueChange={(c) => {
          setCents(c);
          props.onCents?.(c);
        }}
      />
      <output data-testid="cents">{String(cents)}</output>
    </>
  );
}

describe('MoneyInput', () => {
  it('reports integer cents and formats on blur', async () => {
    const onCents = vi.fn();
    const { container } = render(<ControlledMoney locale="en-US" onCents={onCents} />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(input).toHaveAttribute('inputmode', 'decimal');
    await userEvent.type(input, '1234.5');
    expect(screen.getByTestId('cents')).toHaveTextContent('123450');
    await userEvent.tab();
    expect(input).toHaveValue('1,234.50');
    expect(onCents).toHaveBeenLastCalledWith(123450);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows an error instead of rounding extra decimals', async () => {
    render(<ControlledMoney locale="en-US" />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    await userEvent.type(input, '10.999');
    expect(screen.getByTestId('cents')).toHaveTextContent('null');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Use at most 2 decimal places');
  });

  it('uses the locale decimal separator and currency symbol', async () => {
    render(<ControlledMoney locale="de-DE" currency="EUR" initial={123456} />);
    const input = screen.getByRole('textbox', { name: 'Amount' });
    expect(input).toHaveValue('1.234,56');
    await userEvent.click(input);
    expect(input).toHaveValue('1234,56');
    await userEvent.clear(input);
    await userEvent.type(input, '0,07');
    expect(screen.getByTestId('cents')).toHaveTextContent('7');
    expect(screen.getByText('€')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Select', () => {
  it('is a labelled native select', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Select
        label="To account"
        placeholder="Choose an account"
        defaultValue=""
        onChange={(e) => onChange(e.target.value)}
        options={[
          { value: 'ops', label: 'Operations' },
          { value: 'tax', label: 'Tax reserve' },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'To account' }), 'tax');
    expect(onChange).toHaveBeenCalledWith('tax');
    expect(await axeViolations(container)).toEqual([]);
  });
});

interface Row {
  id: string;
  name: string;
  cents: number;
}
const rows: Row[] = [
  { id: '1', name: 'Payroll', cents: -500000 },
  { id: '2', name: 'Acme invoice', cents: 1250000 },
  { id: '3', name: 'Cloud hosting', cents: -9999 },
];
const columns: TableColumn<Row>[] = [
  { key: 'name', header: 'Description', sortValue: (r) => r.name, rowHeader: true },
  { key: 'cents', header: 'Amount', align: 'end', sortValue: (r) => r.cents, cell: (r) => <Amount cents={r.cents} signed /> },
];

describe('Table', () => {
  const names = () => screen.getAllByRole('rowheader').map((c) => c.textContent);

  it('sorts by column with aria-sort and keyboard-operable headers', async () => {
    const { container } = render(<Table caption="Transactions" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(names()).toEqual(['Payroll', 'Acme invoice', 'Cloud hosting']);

    const amountHeader = screen.getByRole('columnheader', { name: /Amount/ });
    expect(amountHeader).toHaveAttribute('aria-sort', 'none');
    within(amountHeader).getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(amountHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Payroll', 'Cloud hosting', 'Acme invoice']);
    await userEvent.keyboard('{Enter}');
    expect(amountHeader).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Acme invoice', 'Cloud hosting', 'Payroll']);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('honors an initial sort and shows an empty state', () => {
    const { rerender } = render(
      <Table caption="T" columns={columns} rows={rows} getRowKey={(r) => r.id} initialSort={{ key: 'name', direction: 'ascending' }} />,
    );
    expect(names()).toEqual(['Acme invoice', 'Cloud hosting', 'Payroll']);
    rerender(<Table caption="T" columns={columns} rows={[]} getRowKey={(r) => r.id} emptyState="No transactions yet" />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });
});

describe('Badge, Card and Amount', () => {
  it('Card with a title is a labelled region', async () => {
    const { container } = render(
      <Card title="Checking ••1234" actions={<Button size="sm">Details</Button>}>
        <Amount cents={4200000} size="xl" /> <Badge tone="positive">Active</Badge>
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Checking ••1234' })).toBeInTheDocument();
    expect(screen.getByText('$42,000.00')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('Amount shows explicit signs when signed', () => {
    render(
      <>
        <Amount cents={2500} signed />
        <Amount cents={-2500} signed />
      </>,
    );
    expect(screen.getByText('+$25.00')).toHaveClass('tally-amount--positive');
    expect(screen.getByText('-$25.00')).toHaveClass('tally-amount--negative');
  });
});

function DialogHarness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Confirm transfer"
        description="Send $25.00 to Operations?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button>Confirm</Button>
          </>
        }
      />
    </>
  );
}

describe('Dialog', () => {
  it('is a labelled modal that traps focus, closes on Escape and restores focus', async () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Confirm transfer' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Send $25.00 to Operations?');
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    await userEvent.tab(); // wraps
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps backwards
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();

    expect(await axeViolations(document.body)).toEqual([]);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
    expect(opener).toHaveFocus();
  });
});

describe('Dialog landmarks', () => {
  it("doesn't add banner/contentinfo landmarks next to the page's own when portalled to <body>", async () => {
    render(
      <>
        <header>Page header</header>
        <main>
          <DialogHarness />
        </main>
        <footer>Page footer</footer>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

function ToastHarness() {
  const toast = useToast();
  return (
    <>
      <Button onClick={() => toast.show({ title: 'Transfer sent', description: '$25.00 to Operations', tone: 'positive' })}>Ok</Button>
      <Button onClick={() => toast.show({ title: 'Transfer failed', tone: 'negative', duration: 0 })}>Fail</Button>
    </>
  );
}

describe('Toast', () => {
  it('announces success politely and auto-dismisses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Ok' }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Transfer sent');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(await axeViolations(document.body)).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('announces errors assertively and can be dismissed', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Transfer failed');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('useToast outside a provider throws a helpful error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
