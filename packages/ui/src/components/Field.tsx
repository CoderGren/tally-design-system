import { useId, type ReactNode } from 'react';
import { cx } from '../utils';

export interface FieldIds {
  inputId: string;
  hintId: string | undefined;
  errorId: string | undefined;
  describedBy: string | undefined;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Visually hide the label but keep it for assistive tech. */
  hideLabel?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  children: (ids: FieldIds) => ReactNode;
}

/** Label + hint + error wiring shared by every form control. */
export function Field({ label, hint, error, hideLabel, required, id, className, children }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? `tally-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('tally-field', error ? 'tally-field--invalid' : undefined, className)}>
      <label htmlFor={inputId} className={cx('tally-field__label', hideLabel && 'tally-visually-hidden')}>
        {label}
        {required && (
          <span className="tally-field__required" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ inputId, hintId, errorId, describedBy })}
      {hint && (
        <p id={hintId} className="tally-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="tally-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
