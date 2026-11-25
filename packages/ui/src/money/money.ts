/**
 * Exact money handling for the UI. Amounts are integer minor units ("cents").
 * Parsing works on strings and BigInt, formatting passes Intl.NumberFormat an exact
 * decimal string, so no binary floating point is involved anywhere.
 */

export type Cents = number;

export interface MoneyOptions {
  currency: string;
  locale?: string;
}

export type ParseResult = { ok: true; cents: Cents } | { ok: false; error: string };

const formatterCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, locale?: string, extra: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale ?? ''}|${currency}|${JSON.stringify(extra)}`;
  let nf = formatterCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { style: 'currency', currency, ...extra });
    formatterCache.set(key, nf);
  }
  return nf;
}

/** Minor-unit digits for a currency: USD 2, JPY 0, BHD 3. */
export function fractionDigits(currency: string): number {
  return currencyFormatter(currency, 'en-US').resolvedOptions().maximumFractionDigits ?? 2;
}

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Converts integer cents to an exact decimal string, e.g. -1999 -> "-19.99". */
export function centsToDecimalString(cents: Cents | bigint, digits = 2): string {
  if (typeof cents === 'number' && !isCents(cents)) throw new RangeError('cents must be a safe integer');
  const big = BigInt(cents);
  const negative = big < 0n;
  const abs = (negative ? -big : big).toString().padStart(digits + 1, '0');
  const major = digits === 0 ? abs : abs.slice(0, -digits);
  const minor = digits === 0 ? '' : `.${abs.slice(-digits)}`;
  return `${negative ? '-' : ''}${major}${minor}`;
}

export interface FormatOptions extends MoneyOptions {
  /** 'exceptZero' shows +/−, useful for transaction lists. */
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
  /** Hide the currency symbol (for editable inputs). */
  hideSymbol?: boolean;
}

/** Locale-aware currency formatting of integer cents. */
export function formatCents(cents: Cents | bigint, opts: FormatOptions): string {
  const digits = fractionDigits(opts.currency);
  const decimal = centsToDecimalString(cents, digits);
  const nf = opts.hideSymbol
    ? new Intl.NumberFormat(opts.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: opts.signDisplay ?? 'auto' })
    : currencyFormatter(opts.currency, opts.locale, opts.signDisplay ? { signDisplay: opts.signDisplay } : {});
  // Intl.NumberFormat accepts exact decimal strings (ECMA-402 NumberFormat v3).
  return nf.format(decimal as unknown as number);
}

interface Separators {
  group: string;
  decimal: string;
  /** Digits in the group next to the decimal point (3 almost everywhere). */
  primaryGroup: number;
  /** Digits in the groups further left (2 in en-IN: 12,34,567). */
  secondaryGroup: number;
}

const separatorCache = new Map<string, Separators>();

export function localeSeparators(locale?: string): Separators {
  const key = locale ?? '';
  let seps = separatorCache.get(key);
  if (!seps) {
    const parts = new Intl.NumberFormat(locale, { useGrouping: true }).formatToParts(123456789012.5);
    const integers = parts.filter((p) => p.type === 'integer').map((p) => p.value.length);
    const primaryGroup = integers.length > 1 ? integers[integers.length - 1]! : 3;
    seps = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      primaryGroup,
      secondaryGroup: integers.length > 2 ? integers[integers.length - 2]! : primaryGroup,
    };
    separatorCache.set(key, seps);
  }
  return seps;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SPACES = /[\s\u00a0\u202f]/u;
const GROUP_MARK = '\u0001';

/**
 * Accepts the integer part only if every group separator sits where the locale puts one:
 * "1,234,567" and en-IN "12,34,567" pass; "1,00", "1,2,3" and "12,34" fail. No separators at all is fine.
 */
function validGrouping(whole: string, group: string, seps: Separators): boolean {
  if (!whole.includes(group)) return /^\d*$/.test(whole);
  const chunks = whole.split(group);
  if (!chunks.every((c) => /^\d+$/.test(c))) return false;
  const last = chunks[chunks.length - 1]!;
  if (last.length !== seps.primaryGroup) return false;
  const middle = chunks.slice(1, -1);
  if (!middle.every((c) => c.length === seps.secondaryGroup)) return false;
  const firstMax = chunks.length === 2 ? seps.primaryGroup : seps.secondaryGroup;
  return chunks[0]!.length <= firstMax;
}

/**
 * Parses user input like "$1,234.56", "1.234,56 €", "(12.00)" or "-5" into integer cents.
 * Never rounds: input with more decimals than the currency allows is rejected.
 */
export function parseMoney(input: string, opts: MoneyOptions & { allowNegative?: boolean }): ParseResult {
  const digits = fractionDigits(opts.currency);
  const seps = localeSeparators(opts.locale);
  const { decimal } = seps;
  let s = input.normalize('NFKC').trim();
  if (s === '') return { ok: false, error: 'Enter an amount' };

  let parens = false;
  if (/^\(.*\)$/.test(s)) {
    parens = true;
    s = s.slice(1, -1);
  }
  s = s.replace(new RegExp(escapeRe(opts.currency), 'gi'), '').replace(/\p{Sc}/gu, '');
  // Locales that group with (narrow) no-break spaces: keep spaces *between digits* as group marks.
  const spaceGroup = SPACES.test(seps.group) || seps.group.trim() === '';
  if (spaceGroup) s = s.trim().replace(/(?<=\d)[\s\u00a0\u202f]+(?=\d)/gu, GROUP_MARK);
  s = s.replace(/[\s\u00a0\u202f]/gu, '');
  const group = spaceGroup ? GROUP_MARK : seps.group;

  let sign = false;
  if (/^[-\u2212]/.test(s)) {
    sign = true;
    s = s.slice(1);
  } else if (/[-\u2212]$/.test(s)) {
    sign = true;
    s = s.slice(0, -1);
  }
  if (parens && sign) return { ok: false, error: 'Use parentheses or a minus sign, not both' };
  const negative = parens || sign;
  if (!sign) s = s.replace(/^\+/, '');

  const pieces = s.split(decimal);
  if (pieces.length > 2) return { ok: false, error: 'Enter a valid amount' };
  const [wholeRaw = '', frac = ''] = pieces;
  if (!/^\d*$/.test(frac)) return { ok: false, error: wholeRaw.length > 0 && frac.includes(group) ? 'Check the thousands separator' : 'Enter a valid amount' };
  if (!/^[\d]*$/.test(wholeRaw.split(group).join(''))) return { ok: false, error: 'Enter a valid amount' };
  if (!validGrouping(wholeRaw, group, seps)) return { ok: false, error: 'Check the thousands separator' };
  const whole = wholeRaw.split(group).join('');
  if (whole === '' && frac === '') return { ok: false, error: 'Enter a valid amount' };

  if (frac.length > digits) {
    return { ok: false, error: digits === 0 ? `${opts.currency} has no minor units` : `Use at most ${digits} decimal places` };
  }
  const big = BigInt(whole || '0') * 10n ** BigInt(digits) + BigInt(frac.padEnd(digits, '0') || '0');
  const signed = negative ? -big : big;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    return { ok: false, error: 'Amount is too large' };
  }
  if (signed < 0n && !opts.allowNegative) return { ok: false, error: 'Amount must be positive' };
  return { ok: true, cents: Number(signed) };
}

/** Editable representation: locale decimal separator, no grouping, no symbol. "1234,5" in de-DE. */
export function toEditableString(cents: Cents, opts: MoneyOptions): string {
  const digits = fractionDigits(opts.currency);
  const { decimal } = localeSeparators(opts.locale);
  return centsToDecimalString(cents, digits).replace('.', decimal);
}

/** Overflow-checked sum of integer cents. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0n;
  for (const v of values) {
    if (!isCents(v)) throw new RangeError('values must be safe integers');
    total += BigInt(v);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError('sum overflow');
  return Number(total);
}
