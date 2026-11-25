/**
 * Generates src/styles/tokens.css from src/tokens/tokens.ts.
 * Run with `pnpm tokens` (Node 22.18+ / 24 strips TypeScript types natively).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { color, font, radius, shadow, space } from '../src/tokens/tokens.ts';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function renderTokensCss(): string {
  const out: string[] = ['/* Generated from src/tokens/tokens.ts; kept in sync by tokens.test.ts */', ':root {'];
  for (const [k, v] of Object.entries(space)) out.push(`  --tally-space-${k}: ${v};`);
  for (const [k, v] of Object.entries(radius)) out.push(`  --tally-radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(font.size)) out.push(`  --tally-font-size-${k}: ${v};`);
  for (const [k, v] of Object.entries(shadow)) out.push(`  --tally-shadow-${k}: ${v};`);
  out.push(`  --tally-font-sans: ${font.family.sans};`, `  --tally-font-mono: ${font.family.mono};`, '}');

  const theme = (selector: string, scheme: 'light' | 'dark', indent = '') => {
    out.push(`${indent}${selector} {`, `${indent}  color-scheme: ${scheme};`);
    for (const [k, v] of Object.entries(color[scheme])) out.push(`${indent}  --tally-color-${kebab(k)}: ${v};`);
    out.push(`${indent}}`);
  };
  theme(":root,\n[data-theme='light']", 'light');
  theme("[data-theme='dark']", 'dark');
  out.push('@media (prefers-color-scheme: dark) {');
  theme(":root:not([data-theme='light'])", 'dark', '  ');
  out.push('}');
  return `${out.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), renderTokensCss());
  console.log('wrote src/styles/tokens.css');
}
