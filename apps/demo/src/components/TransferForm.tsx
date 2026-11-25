import { Button, Card, Dialog, MoneyInput, Select, TextField, formatCents, useToast } from '@tally/ui';
import { useState, type FormEvent } from 'react';
import { LedgerApiError, isOutcomeUnknown, type LedgerClient } from '../api/types';
import type { AccountOption } from '../api/config';
import { newIdempotencyKey } from '../useLedger';

export interface TransferFormProps {
  client: LedgerClient;
  from: AccountOption;
  counterparties: AccountOption[];
  availableCents: number | null;
  onPosted: () => Promise<void> | void;
}

interface Pending {
  toAccountId: string;
  amountCents: number;
  memo: string;
  /**
   * Created when the user first reviews these details and kept across failed attempts until the
   * ledger gives a definitive answer or the user edits the form, so a retry can never post twice.
   */
  idempotencyKey: string;
}

export function TransferForm({ client, from, counterparties, availableCents, onPosted }: TransferFormProps) {
  const toast = useToast();
  const [toAccountId, setToAccountId] = useState('');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<{ to?: string; amount?: string; memo?: string }>({});
  const [pending, setPending] = useState<Pending | null>(null);
  /** A sent transfer whose outcome is unknown (timeout, network, 5xx). Its key is reused on retry. */
  const [unconfirmed, setUnconfirmed] = useState<Pending | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editing the details means a different transfer, so it gets a new key.
  const edited = () => setUnconfirmed(null);

  const uncertain = pending !== null && unconfirmed !== null && pending.idempotencyKey === unconfirmed.idempotencyKey;
  const nameOf = (id: string) => counterparties.find((c) => c.id === id)?.name ?? id;

  const review = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!toAccountId) next.to = 'Choose where to send the money';
    if (amountCents === null || amountCents <= 0) next.amount = 'Enter an amount greater than zero';
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
      toast.show({ title: 'Transfer sent', description: `${formatCents(pending.amountCents, { currency: 'USD' })} to ${nameOf(pending.toAccountId)}`, tone: 'positive' });
      setPending(null);
      setUnconfirmed(null);
      setAmountCents(null);
      setMemo('');
      setToAccountId('');
      await onPosted();
    } catch (err) {
      if (isOutcomeUnknown(err)) {
        // It may have posted. Keep the same key and let the user retry safely; never show success.
        setUnconfirmed(pending);
        return;
      }
      toast.show({
        title: 'Transfer failed',
        description: err instanceof LedgerApiError ? err.message : 'The transfer was not sent.',
        tone: 'negative',
        duration: 0,
      });
      setPending(null);
      setUnconfirmed(null);
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
          onChange={(e) => {
            edited();
            setToAccountId(e.target.value);
          }}
          options={counterparties.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.to}
          required
        />
        <MoneyInput
          label="Amount"
          valueCents={amountCents}
          onValueChange={(v) => {
            if (v !== amountCents) edited();
            setAmountCents(v);
          }}
          error={errors.amount}
          hint={availableCents !== null ? `Available: ${formatCents(availableCents, { currency: 'USD' })}` : undefined}
          required
        />
        <TextField label="Memo" value={memo} onChange={(e) => {
            edited();
            setMemo(e.target.value);
          }} error={errors.memo} hint="Optional, shown on both statements" maxLength={140} />
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
        description={
          pending
            ? uncertain
              ? `The ledger didn't answer, so ${formatCents(pending.amountCents, { currency: 'USD' })} to ${nameOf(pending.toAccountId)} may or may not have been sent. Retrying resends the same request, so it can only post once.`
              : `Send ${formatCents(pending.amountCents, { currency: 'USD' })} from ${from.name} to ${nameOf(pending.toAccountId)}?`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={submitting}>
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
