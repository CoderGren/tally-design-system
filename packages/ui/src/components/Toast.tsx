import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastOptions, type ToastTone } from './toast-context';
import { cx } from '../utils';


type ToastItem = ToastOptions & { id: number; tone: ToastTone; duration: number };

/**
 * Provides toasts through a polite live region. Errors use role="alert" so they are
 * announced immediately. Timers pause while the pointer or focus is inside a toast.
 */
export function ToastProvider({ children, max = 3 }: { children: ReactNode; max?: number }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const item: ToastItem = { ...options, tone: options.tone ?? 'neutral', duration: options.duration ?? 5000, id };
      setToasts((list) => [...list, item].slice(-max));
      return id;
    },
    [max],
  );
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="tally-toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, paused, onDismiss]);

  return (
    <div
      className={cx('tally-toast', `tally-toast--${toast.tone}`)}
      role={toast.tone === 'negative' ? 'alert' : 'status'}
      aria-live={toast.tone === 'negative' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="tally-toast__content">
        <p className="tally-toast__title">{toast.title}</p>
        {toast.description && <p className="tally-toast__description">{toast.description}</p>}
      </div>
      <button type="button" className="tally-toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
