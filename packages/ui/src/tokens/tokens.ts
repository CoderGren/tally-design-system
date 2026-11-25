/**
 * Design tokens. The CSS custom properties in `styles/tokens.css` mirror these values;
 * a unit test keeps the two in sync.
 */
export const color = {
  light: {
    bg: '#f7f7f5',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    border: '#d9d9d4',
    borderStrong: '#8c8c85',
    text: '#1c1c1a',
    textMuted: '#5c5c57',
    accent: '#3d3fd6',
    accentHover: '#2f31b3',
    accentText: '#ffffff',
    focus: '#3d3fd6',
    positive: '#17703a',
    positiveBg: '#e3f4e8',
    negative: '#b3261e',
    negativeBg: '#fbe7e5',
    warning: '#8a5a00',
    warningBg: '#fdf1d6',
    neutralBg: '#ececea',
    overlay: 'rgba(20, 20, 18, 0.48)',
  },
  dark: {
    bg: '#121211',
    surface: '#1c1c1a',
    surfaceRaised: '#252523',
    border: '#3a3a37',
    borderStrong: '#77776f',
    text: '#f2f2ee',
    textMuted: '#a9a9a2',
    accent: '#9b9dff',
    accentHover: '#b6b8ff',
    accentText: '#12122e',
    focus: '#b6b8ff',
    positive: '#6fd394',
    positiveBg: '#173a24',
    negative: '#ff8f86',
    negativeBg: '#4a1d1a',
    warning: '#f3c35d',
    warningBg: '#3d2e0c',
    neutralBg: '#2c2c29',
    overlay: 'rgba(0, 0, 0, 0.64)',
  },
} as const;

export const space = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
} as const;

export const radius = { sm: '6px', md: '10px', lg: '16px', pill: '999px' } as const;

export const font = {
  family: {
    sans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  size: { xs: '12px', sm: '14px', md: '16px', lg: '20px', xl: '28px', xxl: '40px' },
  weight: { regular: '400', medium: '500', semibold: '600' },
  lineHeight: { tight: '1.2', normal: '1.5' },
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.06)',
  md: '0 4px 16px rgba(0, 0, 0, 0.10)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.20)',
} as const;

export type ThemeName = keyof typeof color;
export type ColorToken = keyof (typeof color)['light'];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Name of the CSS custom property for a token, e.g. cssVar('color', 'textMuted') -> --tally-color-text-muted */
export function cssVarName(group: string, key: string | number): string {
  return `--tally-${group}-${kebab(String(key))}`;
}

/** `var(...)` reference for use in inline styles. */
export function cssVar(group: string, key: string | number): string {
  return `var(${cssVarName(group, key)})`;
}

/** Every CSS custom property the stylesheet must define, by theme. */
export function expectedCssVariables(): { shared: string[]; themed: string[] } {
  const shared = [
    ...Object.keys(space).map((k) => cssVarName('space', k)),
    ...Object.keys(radius).map((k) => cssVarName('radius', k)),
    ...Object.keys(font.size).map((k) => cssVarName('font-size', k)),
    ...Object.keys(shadow).map((k) => cssVarName('shadow', k)),
  ];
  const themed = Object.keys(color.light).map((k) => cssVarName('color', k));
  return { shared, themed };
}
