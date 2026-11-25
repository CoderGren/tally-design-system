import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field } from './Field';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
  /** Decorative adornment before the value (e.g. a currency symbol). Hidden from screen readers. */
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, hideLabel, prefix, suffix, id, required, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} id={id} className={className}>
      {({ inputId, describedBy }) => (
        <div className="tally-input">
          {prefix && (
            <span className="tally-input__adornment" aria-hidden="true">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className="tally-input__control"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            required={required}
            {...rest}
          />
          {suffix && (
            <span className="tally-input__adornment" aria-hidden="true">
              {suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
});
