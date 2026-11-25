import { formatCents, type Cents } from '../money/money';
import { cx } from '../utils';

export interface AmountProps {
  cents: Cents;
  currency?: string;
  locale?: string;
  /** Show +/− and color credits and debits. */
  signed?: boolean;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

/** Formatted money value with tabular figures. */
export function Amount({ cents, currency = 'USD', locale, signed = false, size = 'md', className }: AmountProps) {
  const tone = signed ? (cents > 0 ? 'positive' : cents < 0 ? 'negative' : undefined) : undefined;
  return (
    <span className={cx('tally-amount', `tally-amount--${size}`, tone && `tally-amount--${tone}`, className)}>
      {formatCents(cents, { currency, locale, signDisplay: signed ? 'exceptZero' : 'auto' })}
    </span>
  );
}
