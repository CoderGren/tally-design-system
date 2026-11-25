/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEDGER_API_URL?: string;
  readonly VITE_PRIMARY_ACCOUNT_ID?: string;
  readonly VITE_PRIMARY_ACCOUNT_NAME?: string;
  /** Comma-separated `id:Display name` pairs. */
  readonly VITE_COUNTERPARTY_ACCOUNTS?: string;
}
