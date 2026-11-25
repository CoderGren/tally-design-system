import type { HTMLAttributes } from 'react';
import { cx } from '../utils';

export type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Short status label. Meaning is carried by the text, never by color alone. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('tally-badge', `tally-badge--${tone}`, className)} {...rest} />;
}
