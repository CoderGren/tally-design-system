import { Badge, Button, Dialog, ThemeProvider, ToastProvider, formatCents, useToast } from '@tally/ui';
import { useMemo, useState } from 'react';
import type { DemoConfig } from './api/config';
import { LedgerApiError, isOutcomeUnknown, type AccountEntry } from './api/types';
import { BalanceCard } from './components/BalanceCard';
import { TransactionsTable } from './components/TransactionsTable';
import { TransferForm } from './components/TransferForm';
import { newIdempotencyKey, useLedger } from './useLedger';

export interface AppProps {
  createConfig: (onFallback: (reason: unknown) => void) => DemoConfig;
}

export function App(props: AppProps) {
  return (
    <ToastProvider>
      <Dashboard {...props} />
    </ToastProvider>
  );
}

function Dashboard({ createConfig }: AppProps) {
  const toast = useToast();
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );
  const [fellBack, setFellBack] = useState(false);
  const [config] = useState(() =>
    createConfig(() => {
      setFellBack(true);
      toast.show({ title: 'Using demo data', description: 'The ledger API was unreachable at start-up, so this session shows the built-in mock. Reload to try the live API again.' });
    }),
  );
  const { client, primary, counterparties } = config;
  const ledger = useLedger(client, primary.id);
  const [reversing, setReversing] = useState<AccountEntry | null>(null);
  const [reversingBusy, setReversingBusy] = useState(false);
  /** Key for a reversal whose outcome is unknown; reused until a definitive answer. */
  const [unconfirmedReversal, setUnconfirmedReversal] = useState<{ transactionId: string; key: string } | null>(null);
  const reversalUncertain = reversing !== null && unconfirmedReversal?.transactionId === reversing.transactionId;

  const names = useMemo(() => new Map([[primary.id, primary.name], ['funding', 'Incoming wires'], ...counterparties.map((c) => [c.id, c.name] as const)]), [primary, counterparties]);
  const accountName = (id: string) => names.get(id) ?? id;

  const reversedTxnIds = useMemo(
    () => new Set(ledger.entries.flatMap((e) => (e.kind === 'reversal' && e.reversesTransactionId ? [e.reversesTransactionId] : []))),
    [ledger.entries],
  );
  // Reversal rows read better with the original transfer's memo.
  const entries = useMemo(() => {
    const memoById = new Map(ledger.entries.map((e) => [e.transactionId, e.memo]));
    return ledger.entries.map((e) =>
      e.kind === 'reversal' && e.reversesTransactionId ? { ...e, memo: `Reversal: ${memoById.get(e.reversesTransactionId) ?? 'transfer'}` } : e,
    );
  }, [ledger.entries]);

  const reverse = async () => {
    if (!reversing) return;
    setReversingBusy(true);
    const key = unconfirmedReversal?.transactionId === reversing.transactionId ? unconfirmedReversal.key : newIdempotencyKey();
    try {
      await client.reverseTransaction(reversing.transactionId, key);
      setUnconfirmedReversal(null);
      setReversing(null);
      toast.show({ title: 'Transfer reversed', description: reversing.memo ?? reversing.transactionId, tone: 'positive' });
      await ledger.refresh();
    } catch (err) {
      if (isOutcomeUnknown(err)) {
        // It may have posted: keep the dialog open and the same key for a safe retry.
        setUnconfirmedReversal({ transactionId: reversing.transactionId, key });
        return;
      }
      setUnconfirmedReversal(null);
      setReversing(null);
      toast.show({ title: 'Reversal failed', description: err instanceof LedgerApiError ? err.message : 'The reversal was not posted.', tone: 'negative', duration: 0 });
    } finally {
      setReversingBusy(false);
    }
  };

  const live = client.mode === 'live' && !fellBack;

  return (
    <ThemeProvider theme={theme}>
      <div className="demo-shell tally-root">
        <header className="demo-header">
          <div>
            <p className="demo-eyebrow">Tally demo</p>
            <h1>Business account</h1>
          </div>
          <div className="demo-header__actions">
            <Badge tone={live ? 'positive' : 'warning'}>{live ? 'Live API' : 'Demo data'}</Badge>
            <Button variant="ghost" size="sm" aria-pressed={theme === 'dark'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
              Dark mode
            </Button>
          </div>
        </header>

        {ledger.error && (
          <p role="alert" className="demo-error">
            {ledger.error}
          </p>
        )}

        <main className="demo-grid">
          <BalanceCard balance={ledger.balance} entries={ledger.entries} loading={ledger.loading} />
          <TransferForm client={client} from={primary} counterparties={counterparties} availableCents={ledger.balance?.balanceCents ?? null}
            currency={ledger.balance?.currency ?? null}
            onPosted={ledger.refresh}
          />
          <div className="demo-grid__wide">
            <TransactionsTable entries={entries} accountName={accountName} reversedIds={reversedTxnIds} onReverse={setReversing} />
          </div>
        </main>

        <Dialog
          open={reversing !== null}
          role="alertdialog"
          onClose={() => !reversingBusy && setReversing(null)}
          title={reversalUncertain ? "We couldn't confirm this reversal" : 'Reverse this transfer?'}
          description={
            reversing
              ? reversalUncertain
                ? "The ledger didn't answer, so the reversal may or may not have been posted. Retrying resends the same request, so it can only happen once."
                : `${reversing.memo ?? 'Transfer'}: ${formatCents(-reversing.amountCents, { currency: reversing.currency, signDisplay: 'exceptZero' })} will be posted back. This can only happen once.`
              : undefined
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setReversing(null)} disabled={reversingBusy}>
                Keep it
              </Button>
              <Button variant="danger" onClick={reverse} loading={reversingBusy}>
                {reversalUncertain ? 'Retry reversal' : 'Reverse transfer'}
              </Button>
            </>
          }
        />
      </div>
    </ThemeProvider>
  );
}
