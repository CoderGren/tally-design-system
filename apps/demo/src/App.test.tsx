import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { createMockClient, DEFAULT_COUNTERPARTIES, DEFAULT_PRIMARY, loadDemoConfig, type DemoConfig } from './api/config';
import { LedgerApiError, LedgerUnreachableError, type LedgerClient } from './api/types';

const renderApp = () => render(<App createConfig={(onFallback) => loadDemoConfig({}, onFallback, 0)} />);

async function violations(root: Element = document.body) {
  const res = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('demo dashboard', () => {
  it('shows the balance, transactions and data source, with no axe violations', async () => {
    renderApp();
    const balance = await screen.findByText('$98,917.37');
    expect(balance).toBeInTheDocument();
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Account transactions' });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 6);
    expect(await violations()).toEqual([]);
  });

  it('sends a transfer through review and confirmation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('$98,917.37');

    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    expect(screen.getByRole('combobox', { name: /To/ })).toHaveAccessibleDescription('Choose where to send the money');
    expect(screen.getByText('Enter an amount greater than zero')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /To/ }), 'tax-reserve');
    await user.type(screen.getByRole('textbox', { name: /Amount/ }), '1,234.56');
    await user.type(screen.getByRole('textbox', { name: 'Memo' }), 'Estimated taxes');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));

    const dialog = await screen.findByRole('dialog', { name: 'Confirm transfer' });
    expect(dialog).toHaveAccessibleDescription('Send $1,234.56 from Operating ••4821 to Tax reserve ••1180?');
    await user.click(within(dialog).getByRole('button', { name: 'Send now' }));

    await screen.findByText('Transfer sent');
    await screen.findByText('$97,682.81');
    expect(screen.getByRole('rowheader', { name: 'Estimated taxes' })).toBeInTheDocument();
  });

  it('blocks transfers above the available balance', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('$98,917.37');
    await user.selectOptions(screen.getByRole('combobox', { name: /To/ }), 'payroll');
    await user.type(screen.getByRole('textbox', { name: /Amount/ }), '100000');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    expect(screen.getByText('Amount is more than the available balance')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reverses a transfer once and marks it reversed', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText('$98,917.37');
    await user.click(screen.getByRole('button', { name: 'Reverse Cloud hosting' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Reverse this transfer?' });
    await user.click(within(confirm).getByRole('button', { name: 'Reverse transfer' }));
    await screen.findByText('Transfer reversed');
    await screen.findByText('$99,399.50');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reverse Cloud hosting' })).not.toBeInTheDocument());
    expect(screen.getByRole('rowheader', { name: 'Reversal: Cloud hosting' })).toBeInTheDocument();
    expect(screen.getByText('Reversed')).toBeInTheDocument();
  });
});

/**
 * A mock ledger whose next N writes commit on the "server" and then lose the response, which is
 * exactly the ambiguous case: the money moved, but the client saw a timeout.
 */
function flakyConfig(opts: { lostResponses?: number; rejectFirstWith?: LedgerApiError; plan?: Array<'lost' | 'ok' | LedgerApiError> } = {}) {
  const inner = createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0);
  const keys: string[] = [];
  let lost = opts.lostResponses ?? 0;
  let reject = opts.rejectFirstWith;
  const client: LedgerClient = {
    mode: 'mock',
    getBalance: (id) => inner.getBalance(id),
    listTransactions: (id, o) => inner.listTransactions(id, o),
    postTransfer: async (input, key) => {
      keys.push(key);
      if (opts.plan) {
        const step = opts.plan.shift() ?? 'ok';
        if (step instanceof LedgerApiError) throw step;
        const txn = await inner.postTransfer(input, key);
        if (step === 'lost') throw new LedgerUnreachableError('POST /transfers did not complete');
        return txn;
      }
      if (reject) {
        const err = reject;
        reject = undefined;
        throw err;
      }
      const txn = await inner.postTransfer(input, key);
      if (lost-- > 0) throw new LedgerUnreachableError('POST /transfers did not complete');
      return txn;
    },
    reverseTransaction: async (id, key) => {
      keys.push(key);
      const txn = await inner.reverseTransaction(id, key);
      if (lost-- > 0) throw new LedgerUnreachableError('POST reversal did not complete');
      return txn;
    },
  };
  const config: DemoConfig = { client, primary: DEFAULT_PRIMARY, counterparties: DEFAULT_COUNTERPARTIES };
  return { config, keys };
}

async function fillTransfer(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.selectOptions(screen.getByRole('combobox', { name: /To/ }), 'payroll');
  await user.type(screen.getByRole('textbox', { name: /Amount/ }), amount);
  await user.click(screen.getByRole('button', { name: 'Review transfer' }));
}

describe('D-M2: ambiguous failures keep the idempotency key', () => {
  it('a timed-out transfer shows an unknown outcome (never success) and Retry reuses the same key', async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ lostResponses: 1 });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await fillTransfer(user, '100');
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));

    const unknown = await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" });
    expect(screen.queryByText('Transfer sent')).not.toBeInTheDocument();
    await user.click(within(unknown).getByRole('button', { name: 'Retry safely' }));

    await screen.findByText('Transfer sent');
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
    // The first attempt had committed; the retry replayed it, so the money moved exactly once.
    await screen.findByText('$98,817.37');
  });

  it("D-N1 (Hanna's repro): clearing and retyping the same amount after an unknown outcome reuses the key; money moves once", async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ lostResponses: 1 });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await fillTransfer(user, '100');
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await user.click(within(await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" })).getByRole('button', { name: 'Close' }));
    // The refresh after the unknown outcome already shows the committed transfer.
    await screen.findByText('$98,817.37');

    const amount = screen.getByRole('textbox', { name: /Amount/ });
    await user.clear(amount);
    await user.type(amount, '100'); // passes through 1 and 10 on the way
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    const retry = await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" });
    await user.click(within(retry).getByRole('button', { name: 'Retry safely' }));

    await screen.findByText('Transfer sent');
    expect(keys).toEqual([keys[0], keys[0]]);
    // $98,917.37 - $100.00 exactly once (the double-post would show $98,717.37).
    await screen.findByText('$98,817.37');
    expect(screen.queryByText('$98,717.37')).not.toBeInTheDocument();
  });

  it('closing and reviewing the same details again reuses the key; different details start a new one, with a warning', async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ lostResponses: 2 });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await fillTransfer(user, '100');
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await user.click(within(await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" })).getByRole('button', { name: 'Close' }));
    expect(screen.getByText(/couldn.t confirm your last transfer/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    await user.click(within(await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" })).getByRole('button', { name: 'Retry safely' }));
    await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" });
    expect(keys[1]).toBe(keys[0]);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.clear(screen.getByRole('textbox', { name: /Amount/ }));
    await user.type(screen.getByRole('textbox', { name: /Amount/ }), '105');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    const fresh = await screen.findByRole('dialog', { name: 'Confirm transfer' });
    // Announced: part of the dialog's accessible description and an alert, with Cancel focused.
    const warning = 'Your previous transfer of $100.00 to Payroll ••7702 may already have posted. Check Transactions before sending another.';
    expect(fresh).toHaveAccessibleDescription(`Send $105.00 from Operating ••4821 to Payroll ••7702?${warning}`);
    expect(within(fresh).getByRole('alert')).toHaveTextContent(warning);
    expect(within(fresh).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(await violations(fresh)).toEqual([]);
    await user.click(within(fresh).getByRole('button', { name: 'Send now' }));
    await screen.findByText('Transfer sent');
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('a definitive 4xx clears the key, so the next attempt is a new request', async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ rejectFirstWith: new LedgerApiError(422, 'INSUFFICIENT_FUNDS', 'Operating has insufficient funds') });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await fillTransfer(user, '100');
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await screen.findByText('Transfer failed');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await screen.findByText('Transfer sent');
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('a timed-out reversal keeps the dialog open and retries with the same key', async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ lostResponses: 1 });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await user.click(screen.getByRole('button', { name: 'Reverse Cloud hosting' }));
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Reverse this transfer?' })).getByRole('button', { name: 'Reverse transfer' }));
    const unknown = await screen.findByRole('alertdialog', { name: "We couldn't confirm this reversal" });
    expect(screen.queryByText('Transfer reversed')).not.toBeInTheDocument();
    await user.click(within(unknown).getByRole('button', { name: 'Retry reversal' }));
    await screen.findByText('Transfer reversed');
    expect(keys).toEqual([keys[0], keys[0]]);
    await screen.findByText('$99,399.50');
  });
});

describe('Re-review 2: the earlier unconfirmed transfer is never forgotten', () => {
  it('when a different, new transfer fails outright, the earlier warning and its key survive', async () => {
    const user = userEvent.setup();
    const { config, keys } = flakyConfig({ plan: ['lost', new LedgerApiError(422, 'INSUFFICIENT_FUNDS', 'Operating has insufficient funds'), 'ok'] });
    render(<App createConfig={() => config} />);
    await screen.findByText('$98,917.37');
    await fillTransfer(user, '100');
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await user.click(within(await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" })).getByRole('button', { name: 'Close' }));

    // A different transfer, confirmed despite the warning, is rejected outright.
    const amount = screen.getByRole('textbox', { name: /Amount/ });
    await user.clear(amount);
    await user.type(amount, '250');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Confirm transfer' })).getByRole('button', { name: 'Send now' }));
    await screen.findByText('Transfer failed');
    expect(screen.getByText(/Your earlier transfer of \$100\.00 to Payroll ••7702 is still unconfirmed/)).toBeInTheDocument();
    // The form-level warning is back, announced as a status.
    expect(screen.getByText(/couldn.t confirm your last transfer/)).toHaveAttribute('role', 'status');

    // And the earlier transfer still retries with its original key, posting once.
    await user.clear(amount);
    await user.type(amount, '100');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    await user.click(within(await screen.findByRole('dialog', { name: "We couldn't confirm this transfer" })).getByRole('button', { name: 'Retry safely' }));
    await screen.findByText('Transfer sent');
    expect(keys[2]).toBe(keys[0]);
    expect(keys[1]).not.toBe(keys[0]);
    await screen.findByText('$98,817.37');
  });
});

describe('D-M4: the dashboard uses the account currency', () => {
  it('a JPY account parses, confirms and shows yen, not dollars', async () => {
    const user = userEvent.setup();
    const config: DemoConfig = {
      client: createMockClient(DEFAULT_PRIMARY, DEFAULT_COUNTERPARTIES, 0, 'JPY'),
      primary: DEFAULT_PRIMARY,
      counterparties: DEFAULT_COUNTERPARTIES,
    };
    render(<App createConfig={() => config} />);
    // Same seed history in minor units; JPY has none, so 9,891,737 yen.
    await screen.findByText('¥9,891,737');
    expect(screen.getByText('Available: ¥9,891,737')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /To/ }), 'payroll');
    await user.type(screen.getByRole('textbox', { name: /Amount/ }), '500');
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm transfer' });
    expect(dialog).toHaveAccessibleDescription('Send ¥500 from Operating ••4821 to Payroll ••7702?');
    await user.click(within(dialog).getByRole('button', { name: 'Send now' }));
    await screen.findByText('¥9,891,237');

    // Yen has no minor units, so "5.5" is rejected rather than rounded.
    await user.type(screen.getByRole('textbox', { name: /Amount/ }), '5.5');
    expect(await screen.findByText('JPY has no minor units')).toBeInTheDocument();
    // Submitting keeps the specific parse error instead of a generic "Enter an amount" message.
    await user.click(screen.getByRole('button', { name: 'Review transfer' }));
    expect(screen.getByRole('textbox', { name: /Amount/ })).toHaveAccessibleDescription(/JPY has no minor units/);
    expect(screen.queryByText('Enter an amount greater than zero')).not.toBeInTheDocument();
  });
});
