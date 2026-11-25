import { createContext, useContext, type ReactNode } from 'react';

export type ToastTone = 'neutral' | 'positive' | 'negative';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed. Default 5000. */
  duration?: number;
}

export interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

