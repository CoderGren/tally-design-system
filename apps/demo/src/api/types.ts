/**
 * Wire types for the ledger API (see the companion `ledger-api-cdk` project).
 * All amounts are integer minor units.
 */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'JPY';

export interface Balance {
  accountId: string;
  name: string;
  currency: Currency;
  balanceCents: number;
}

export type TransactionKind = 'transfer' | 'reversal';

export interface Entry {
  accountId: string;
  amountCents: number;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  currency: Currency;
  entries: Entry[];
  memo?: string;
  createdAt: string;
  idempotencyKey: string;
  reversesTransactionId?: string;
}

export interface AccountEntry {
  transactionId: string;
  accountId: string;
  counterpartyAccountId: string;
  kind: TransactionKind;
  amountCents: number;
  currency: Currency;
  memo?: string;
  createdAt: string;
  /** On reversal rows: the transaction being reversed. */
  reversesTransactionId?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  memo?: string;
}

export type LedgerErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'CURRENCY_MISMATCH'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ALREADY_REVERSED'
  | 'CONCURRENT_UPDATE'
  | 'INTERNAL';

export interface LedgerClient {
  readonly mode: 'live' | 'mock';
  getBalance(accountId: string): Promise<Balance>;
  listTransactions(accountId: string, opts?: { limit?: number; cursor?: string }): Promise<Page<AccountEntry>>;
  postTransfer(input: TransferInput, idempotencyKey: string): Promise<Transaction>;
  reverseTransaction(transactionId: string, idempotencyKey: string): Promise<Transaction>;
}

/** An error response from the API: the request reached the server and was rejected. */
export class LedgerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LedgerApiError';
  }
}

/**
 * The request may or may not have reached the ledger (network error, timeout, CORS failure).
 * For writes the outcome is unknown: retry with the SAME idempotency key, never a new one.
 */
export class LedgerUnreachableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LedgerUnreachableError';
  }
}

/**
 * True when a write's outcome is unknown and it is only safe to retry with the same key:
 * unreachable, a 5xx (the server may have committed before failing), or a retryable 409 race.
 * Any other 4xx is a definitive "not posted".
 */
export function isOutcomeUnknown(err: unknown): boolean {
  if (err instanceof LedgerUnreachableError) return true;
  if (err instanceof LedgerApiError) return err.status >= 500 || err.code === 'CONCURRENT_UPDATE';
  return true;
}
