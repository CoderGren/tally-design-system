import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks clicks while keeping the button focusable. */
  loading?: boolean;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, iconStart, iconEnd, className, children, disabled, onClick, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('tally-button', `tally-button--${variant}`, `tally-button--${size}`, fullWidth && 'tally-button--full', className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <span className="tally-spinner" aria-hidden="true" /> : iconStart}
      <span className="tally-button__label">{children}</span>
      {!loading && iconEnd}
    </button>
  );
});
