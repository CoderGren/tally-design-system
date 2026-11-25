import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, rendered in the footer. */
  footer?: ReactNode;
  /** 'alertdialog' for confirmations that interrupt the user. */
  role?: 'dialog' | 'alertdialog';
  closeOnOverlayClick?: boolean;
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: 'sm' | 'md';
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Modal dialog: portals to <body>, traps focus, closes on Escape, locks page scroll and
 * restores focus to the element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  role = 'dialog',
  closeOnOverlayClick = true,
  initialFocusRef,
  size = 'md',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
    target?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === 'undefined') return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    // The overlay click is a pointer convenience; keyboard users have Escape and the close button.
    <div
      className="tally-dialog__overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx('tally-dialog', `tally-dialog--${size}`)}
        onKeyDown={onKeyDown}
      >
        <header className="tally-dialog__header">
          <h2 id={titleId} className="tally-dialog__title">
            {title}
          </h2>
          <button type="button" className="tally-dialog__close" onClick={onClose} aria-label="Close dialog">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {description && (
          <p id={descId} className="tally-dialog__description">
            {description}
          </p>
        )}
        {children && <div className="tally-dialog__body">{children}</div>}
        {footer && <footer className="tally-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
