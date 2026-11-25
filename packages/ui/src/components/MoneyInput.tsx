import { forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatCents, parseMoney, toEditableString, type Cents } from '../money/money';
import { TextField, type TextFieldProps } from './TextField';

export interface MoneyInputProps
  extends Omit<TextFieldProps, 'value' | 'defaultValue' | 'onChange' | 'type' | 'prefix' | 'inputMode' | 'min' | 'max'> {
  label: ReactNode;
  /** Amount in integer minor units, or null when empty/invalid. */
  valueCents: Cents | null;
  onValueChange: (cents: Cents | null) => void;
  currency?: string;
  locale?: string;
  allowNegative?: boolean;
  minCents?: Cents;
  maxCents?: Cents;
}

function currencySymbol(currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
}

/**
 * Currency input that only ever reports integer cents. While focused the user edits a plain
 * decimal; on blur the value is re-rendered with locale grouping. Invalid input is never rounded.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { valueCents, onValueChange, currency = 'USD', locale, allowNegative = false, minCents, maxCents, error, hint, onBlur, onFocus, ...rest },
  ref,
) {
  const display = (cents: Cents | null) => (cents === null ? '' : formatCents(cents, { currency, locale, hideSymbol: true }));
  const [text, setText] = useState(() => display(valueCents));
  const [focused, setFocused] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const symbol = useMemo(() => currencySymbol(currency, locale), [currency, locale]);

  // Follow external value changes (e.g. form reset) when the user is not typing.
  useEffect(() => {
    if (!focused) {
      setText(display(valueCents));
      if (valueCents !== null) setParseError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents, currency, locale]);

  const validate = (raw: string): Cents | null => {
    if (raw.trim() === '') {
      setParseError(null);
      return null;
    }
    const result = parseMoney(raw, { currency, locale, allowNegative });
    if (!result.ok) {
      setParseError(result.error);
      return null;
    }
    if (minCents !== undefined && result.cents < minCents) {
      setParseError(`Minimum is ${formatCents(minCents, { currency, locale })}`);
      return null;
    }
    if (maxCents !== undefined && result.cents > maxCents) {
      setParseError(`Maximum is ${formatCents(maxCents, { currency, locale })}`);
      return null;
    }
    setParseError(null);
    return result.cents;
  };

  return (
    <TextField
      ref={ref}
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      prefix={symbol}
      value={text}
      error={error ?? parseError ?? undefined}
      hint={hint ?? `Amount in ${currency}`}
      onFocus={(e) => {
        setFocused(true);
        if (valueCents !== null) setText(toEditableString(valueCents, { currency, locale }));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        onValueChange(validate(raw));
      }}
      onBlur={(e) => {
        setFocused(false);
        const cents = validate(text);
        if (cents !== null) setText(display(cents));
        onBlur?.(e);
      }}
    />
  );
});
