// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderTokensCss } from '../../scripts/build-tokens.ts';
import { color, cssVar, cssVarName, expectedCssVariables } from './tokens';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

/** WCAG 2.x relative luminance contrast ratio for #rrggbb colors. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('design tokens', () => {
  it('tokens.css is generated from tokens.ts (run `pnpm tokens` if this fails)', () => {
    expect(css).toBe(renderTokensCss());
  });

  it('defines every expected CSS variable', () => {
    const { shared, themed } = expectedCssVariables();
    for (const name of [...shared, ...themed]) expect(css).toContain(`${name}:`);
  });

  it('light and dark themes define the same tokens', () => {
    expect(Object.keys(color.dark).sort()).toEqual(Object.keys(color.light).sort());
  });

  it('builds variable names and references', () => {
    expect(cssVarName('color', 'textMuted')).toBe('--tally-color-text-muted');
    expect(cssVar('space', 4)).toBe('var(--tally-space-4)');
  });

  for (const theme of ['light', 'dark'] as const) {
    const c = color[theme];
    it(`${theme} theme meets WCAG AA contrast for text pairs`, () => {
      const pairs: Array<[string, string, string]> = [
        ['text/surface', c.text, c.surface],
        ['text/bg', c.text, c.bg],
        ['textMuted/surface', c.textMuted, c.surface],
        ['accentText/accent', c.accentText, c.accent],
        ['positive/positiveBg', c.positive, c.positiveBg],
        ['negative/negativeBg', c.negative, c.negativeBg],
        ['warning/warningBg', c.warning, c.warningBg],
        ['positive/surface', c.positive, c.surface],
        ['negative/surface', c.negative, c.surface],
      ];
      for (const [name, fg, bg] of pairs) {
        expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
