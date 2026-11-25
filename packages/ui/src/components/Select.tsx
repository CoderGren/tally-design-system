import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Field } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: ReactNode;
  options: SelectOption[];
  /** Adds an empty, non-selectable first option. */
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  hideLabel?: boolean;
}

/** Styled native select: keeps the platform's accessible picker on every device. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, hint, error, hideLabel, id, required, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} hideLabel={hideLabel} required={required} id={id} className={className}>
      {({ inputId, describedBy }) => (
        <div className="tally-select">
          <select
            ref={ref}
            id={inputId}
            className="tally-select__control"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            required={required}
            {...rest}
          >
            {placeholder !== undefined && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="tally-select__chevron" aria-hidden="true" />
        </div>
      )}
    </Field>
  );
});
