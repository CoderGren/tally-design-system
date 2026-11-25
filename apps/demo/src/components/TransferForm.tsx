import { Button, Card, Dialog, MoneyInput, Select, TextField, formatCents, useToast } from '@tally/ui';
import { useRef, useState, type FormEvent } from 'react';
import { LedgerApiError, isOutcomeUnknown, type LedgerClient } from '../api/types';
import type { AccountOption } from '../api/config';
import { newIdempotencyKey } from '../useLedger';

export interface TransferFormProps {
  client: LedgerClient;
  from: AccountOption;
  counterparties: AccountOption[];
  availableCents: number | null;
  /** The source account's currency, from its balance. Null while it loads. */
  currency: string | null;
  onPosted: () => Promise<void> | void;
}

interface Pending {
  toAccountId: string;
  amountCents: number;
  memo: string;
  /**
   * Created when the user first reviews these details and kept across failed attempts until the
   * ledger gives a definitive answer. Reviewing identical details again reuses it, so a retry can
   * never post twice, however the user got back to those details.
   */
  idempotencyKey: string;
}

export function TransferForm({ client, from, counterparties, availableCents, currency, onPosted }: TransferFormProps) {
  const toast = useToast();
  const [toAccountId, setToAccountId] = useState('');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<{ to?: string; amount?: string; memo?: string }>({});
  const [pending, setPending] = useState<Pending | null>(null);
  /** A sent transfer whose outcome is unknown (timeout, network, 5xx). Its key is reused on retry. */
  const [unconfirmed, setUnconfirmed] = useState<Pending | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Amounts are only parsed and shown once the account's currency is known.
  const ccy = currency ?? 'USD';
  const uncertain = pending !== null && unconfirmed !== null && pending.idempotencyKey === unconfirmed.idempotencyKey;
  /** A new, different transfer while an earlier one is still unconfirmed: warn before sending. */
  const supersedes = pending !== null && unconfirmed !== null && !uncertain;
  const nameOf = (id: string) => counterparties.find((c) => c.id === id)?.name ?? id;

  const review = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!toAccountId) next.to = 'Choose where to send the money';
    if (currency === null) next.amount = 'Account is still loading';
    else if (amountCents === null || amountCents <= 0) next.amount = 'Enter an amount greater than zero';
    else if (availableCents !== null && amountCents > availableCents) next.amount = 'Amount is more than the available balance';
    if (memo.length > 140) next.memo = 'Use 140 characters or fewer';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const details = { toAccountId, amountCents: amountCents!, memo: memo.trim() };
    const sameAsUnconfirmed =
      unconfirmed !== null &&
      unconfirmed.toAccountId === details.toAccountId &&
      unconfirmed.amountCents === details.amountCents &&
      unconfirmed.memo === details.memo;
    setPending(sameAsUnconfirmed ? unconfirmed : { ...details, idempotencyKey: newIdempotencyKey() });
  };

  const confirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      await client.postTransfer(
        { fromAccountId: from.id, toAccountId: pending.toAccountId, amountCents: pending.amountCents, ...(pending.memo ? { memo: pending.memo } : {}) },
        pending.idempotencyKey,
      );
      toast.show({ title: 'Transfer sent', description: `${formatCents(pending.amountCents, { currency: ccy })} to ${nameOf(pending.toAccountId)}`, tone: 'positive' });
      setPending(null);
      setUnconfirmed(null);
      setAmountCents(null);
      setMemo('');
      setToAccountId('');
      await onPosted();
    } catch (err) {
      if (isOutcomeUnknown(err)) {
        // It may have posted. Keep the same key and let the user retry safely; never show success.
        // Refresh too, so a transfer that did commit shows up in Transactions.
        setUnconfirmed(pending);
        await Promise.resolve(onPosted()).catch(() => undefined);
        return;
      }
      // Definitely not posted. That settles THIS request only: an earlier, different transfer that
      // is still unconfirmed keeps its key and its warning.
      const earlier = unconfirmed && unconfirmed.idempotencyKey !== pending.idempotencyKey ? unconfirmed : null;
      const reason = err instanceof LedgerApiError ? err.message : 'The transfer was not sent.';
      toast.show({
        title: 'Transfer failed',
        description: earlier
          ? `${reason}. Your earlier transfer of ${formatCents(earlier.amountCents, { currency: ccy })} to ${nameOf(earlier.toAccountId)} is still unconfirmed.`
          : reason,
        tone: 'negative',
        duration: 0,
      });
      setPending(null);
      setUnconfirmed(earlier);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Move money" description={`From ${from.name}`}>
      <form className="demo-form" onSubmit={review} noValidate>
        <Select
          label="To"
          placeholder="Choose an account"
          value={toAccountId}
onChange={(e) => setToAccountId(e.target.value)}
          options={counterparties.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.to}
          required
        />
        <MoneyInput
          label="Amount"
          valueCents={amountCents}
          currency={ccy}
onValueChange={setAmountCents}
          error={errors.amount}
          hint={availableCents !== null ? `Available: ${formatCents(availableCents, { currency: ccy })}` : undefined}
          required
        />
        <TextField label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} error={errors.memo} hint="Optional, shown on both statements" maxLength={140} />
        {unconfirmed && !pending ? (
          <p className="demo-warning" role="status">
            We couldn&apos;t confirm your last transfer. Review it again with the same details to retry safely (it can only post
            once); changing the details starts a new transfer.
          </p>
        ) : null}
        <Button type="submit" fullWidth>
          Review transfer
        </Button>
      </form>

      <Dialog
        open={pending !== null}
        onClose={() => !submitting && setPending(null)}
        title={uncertain ? "We couldn't confirm this transfer" : 'Confirm transfer'}
        // In the "supersedes" state, Cancel gets focus so Enter doesn't send a possible duplicate.
        initialFocusRef={supersedes ? cancelRef : undefined}
        description={
          pending ? (
            uncertain ? (
              `The ledger didn't answer, so ${formatCents(pending.amountCents, { currency: ccy })} to ${nameOf(pending.toAccountId)} may or may not have been sent. Retrying resends the same request, so it can only post once.`
            ) : (
              <>
                {`Send ${formatCents(pending.amountCents, { currency: ccy })} from ${from.name} to ${nameOf(pending.toAccountId)}?`}
                {supersedes && unconfirmed ? (
                  // Part of the dialog description (aria-describedby, read when the dialog opens) and
                  // role="alert", so screen readers announce it rather than leaving it to be found.
                  <span className="demo-warning demo-warning--block" role="alert">
                    {`Your previous transfer of ${formatCents(unconfirmed.amountCents, { currency: ccy })} to ${nameOf(unconfirmed.toAccountId)} may already have posted. Check Transactions before sending another.`}
                  </span>
                ) : null}
              </>
            )
          ) : undefined
        }
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => setPending(null)} disabled={submitting}>
              {uncertain ? 'Close' : 'Cancel'}
            </Button>
            <Button onClick={confirm} loading={submitting}>
              {uncertain ? 'Retry safely' : 'Send now'}
            </Button>
          </>
        }
      >
        {pending?.memo ? <p className="demo-muted">Memo: {pending.memo}</p> : null}
      </Dialog>
    </Card>
  );
}
