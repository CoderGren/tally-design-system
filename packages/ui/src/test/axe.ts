import axe from 'axe-core';

/**
 * Runs axe-core against a rendered container and returns readable violations.
 * color-contrast is disabled because jsdom does not compute styles; contrast is
 * covered by tokens.test.ts against the token values instead.
 */
export async function axeViolations(container: Element = document.body): Promise<string[]> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
