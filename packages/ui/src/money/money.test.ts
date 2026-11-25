import { describe, expect, it } from 'vitest';
import { centsToDecimalString, formatCents, fractionDigits, parseMoney, sumCents, toEditableString } from './money';

const usd = { currency: 'USD', locale: 'en-US' };
const eurDe = { currency: 'EUR', locale: 'de-DE' };

describe('formatCents', () => {
  it('formats integer cents without float error', () => {
    expect(formatCents(123456, usd)).toBe('$1,234.56');
    expect(formatCents(-5, usd)).toBe('-$0.05');
    expect(formatCents(10 + 20, usd)).toBe('$0.30');
    // Beyond 2^53 / 100 a float division would lose cents; BigInt + decimal strings do not.
    expect(formatCents(9_007_199_254_740_991n, usd)).toBe('$90,071,992,547,409.91');
  });

  it('respects locale and currency minor units', () => {
    expect(formatCents(123456, eurDe)).toBe('1.234,56\u00a0€');
    expect(formatCents(1500, { currency: 'JPY', locale: 'ja-JP' })).toBe('￥1,500');
    expect(fractionDigits('JPY')).toBe(0);
    expect(fractionDigits('BHD')).toBe(3);
  });

  it('supports explicit signs for statements', () => {
    expect(formatCents(2500, { ...usd, signDisplay: 'exceptZero' })).toBe('+$25.00');
    expect(formatCents(0, { ...usd, signDisplay: 'exceptZero' })).toBe('$0.00');
  });

  it('formats without a symbol for editing', () => {
    expect(formatCents(123456, { ...usd, hideSymbol: true })).toBe('1,234.56');
  });
});

describe('parseMoney', () => {
  const ok = (cents: number) => ({ ok: true, cents });

  it('parses common US inputs exactly', () => {
    expect(parseMoney('1234.56', usd)).toEqual(ok(123456));
    expect(parseMoney('$1,234.56', usd)).toEqual(ok(123456));
    expect(parseMoney(' 0.1 ', usd)).toEqual(ok(10));
    expect(parseMoney('.5', usd)).toEqual(ok(50));
    expect(parseMoney('12.', usd)).toEqual(ok(1200));
    expect(parseMoney('USD 7', usd)).toEqual(ok(700));
  });

  it('parses German formatting', () => {
    expect(parseMoney('1.234,56 €', eurDe)).toEqual(ok(123456));
    expect(parseMoney('0,99', eurDe)).toEqual(ok(99));
  });

  it('never rounds: too many decimals is an error', () => {
    expect(parseMoney('1.005', usd)).toEqual({ ok: false, error: 'Use at most 2 decimal places' });
    expect(parseMoney('100.5', { currency: 'JPY', locale: 'ja-JP' })).toMatchObject({ ok: false });
  });

  it('handles negatives only when allowed', () => {
    expect(parseMoney('-5.00', usd)).toEqual({ ok: false, error: 'Amount must be positive' });
    expect(parseMoney('-5.00', { ...usd, allowNegative: true })).toEqual(ok(-500));
    expect(parseMoney('(5.00)', { ...usd, allowNegative: true })).toEqual(ok(-500));
  });

  it('D-M3: rejects misplaced group separators instead of deleting them (no 100x mistakes)', () => {
    const sep = { ok: false, error: 'Check the thousands separator' };
    expect(parseMoney('1,00', usd)).toEqual(sep);
    expect(parseMoney('1.00', eurDe)).toEqual(sep);
    expect(parseMoney('1,2,3', usd)).toEqual(sep);
    expect(parseMoney('12,34', usd)).toEqual(sep);
    expect(parseMoney('1234,567', usd)).toEqual(sep);
    expect(parseMoney('1,234,56', usd)).toEqual(sep);
    expect(parseMoney('1.000,00', usd).ok).toBe(false);
    // Correct grouping, or none at all, still parses.
    expect(parseMoney('1,000', usd)).toEqual(ok(100000));
    expect(parseMoney('1,234,567.89', usd)).toEqual(ok(123456789));
    expect(parseMoney('1234567.89', usd)).toEqual(ok(123456789));
    expect(parseMoney('1.234.567,89', eurDe)).toEqual(ok(123456789));
  });

  it('D-M3: understands locale group sizes and space separators', () => {
    const inr = { currency: 'INR', locale: 'en-IN' };
    expect(parseMoney('12,34,567.89', inr)).toEqual(ok(123456789));
    expect(parseMoney('1,234,567.89', inr)).toEqual({ ok: false, error: 'Check the thousands separator' });
    const frEur = { currency: 'EUR', locale: 'fr-FR' };
    expect(parseMoney(formatCents(123456789, frEur), frEur)).toEqual(ok(123456789));
    expect(parseMoney('1 234 567,89', frEur)).toEqual(ok(123456789));
    expect(parseMoney('1 23,45', frEur)).toEqual({ ok: false, error: 'Check the thousands separator' });
    expect(parseMoney('1,00', { currency: 'JPY', locale: 'ja-JP' })).toEqual({ ok: false, error: 'Check the thousands separator' });
  });

  it('rejects parentheses combined with a minus sign instead of flipping the sign', () => {
    const neg = { ...usd, allowNegative: true };
    expect(parseMoney('(-5)', neg)).toEqual({ ok: false, error: 'Use parentheses or a minus sign, not both' });
    expect(parseMoney('(5-)', neg).ok).toBe(false);
    expect(parseMoney('(5)', neg)).toEqual(ok(-500));
    expect(parseMoney('5-', neg)).toEqual(ok(-500));
  });

  it('rejects garbage and overflow', () => {
    for (const bad of ['', 'abc', '1.2.3', '1e5', '--1', '$']) expect(parseMoney(bad, usd).ok).toBe(false);
    expect(parseMoney('999999999999999999', usd)).toEqual({ ok: false, error: 'Amount is too large' });
  });

  it('round-trips through the editable representation', () => {
    for (const cents of [0, 1, 99, 100, 123456, 9_007_199_254_740_991]) {
      expect(parseMoney(toEditableString(cents, usd), usd)).toEqual(ok(cents));
      expect(parseMoney(toEditableString(cents, eurDe), eurDe)).toEqual(ok(cents));
      expect(parseMoney(formatCents(cents, usd), usd)).toEqual(ok(cents));
    }
  });
});

describe('helpers', () => {
  it('centsToDecimalString pads correctly', () => {
    expect(centsToDecimalString(7)).toBe('0.07');
    expect(centsToDecimalString(-7)).toBe('-0.07');
    expect(centsToDecimalString(1500, 0)).toBe('1500');
    expect(() => centsToDecimalString(1.5)).toThrow(RangeError);
  });

  it('sumCents is exact and overflow-checked', () => {
    expect(sumCents([10, 20, -5])).toBe(25);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow(/overflow/);
  });
});
