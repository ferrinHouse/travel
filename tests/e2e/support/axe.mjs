import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

/** WCAG 2.1 A/AA violations on the current page, as "rule: selectors" strings. */
export async function axeViolations(page) {
  // Next streams page metadata, and router.refresh() re-renders it, so <title>
  // can be missing for a moment. Give it a few seconds to settle; a page that
  // really has no title still fails the scan below.
  await page.waitForFunction(() => document.title.trim() !== '', null, { timeout: 5000 }).catch(() => {});
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
}
