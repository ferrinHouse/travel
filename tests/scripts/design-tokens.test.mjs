// The contrast maths in src/lib/color.js assumes the page/card backgrounds in
// tokens.css. If someone changes one without the other, trip colours could
// silently fail WCAG, so keep them in lockstep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SURFACES, contrastRatio } from '../../src/lib/color.js';
import { THEME_COLORS } from '../../src/lib/theme.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const css = fs.readFileSync(path.join(root, 'src', 'styles', 'tokens.css'), 'utf8');

/** Custom properties declared inside the first block whose selector matches. */
function block(selectorPattern) {
  const match = css.match(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `no block for ${selectorPattern}`);
  return Object.fromEntries([...match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = block(':root');
const dark = block(':root\\[data-theme=["\']?dark["\']?\\]');

test('backgrounds match the surfaces used for contrast checks', () => {
  assert.deepEqual([light['--surface'], light['--bg'], light['--surface-2']], SURFACES.light);
  assert.deepEqual([dark['--surface'], dark['--bg'], dark['--surface-2']], SURFACES.dark);
});

test('browser theme-color matches the page background', () => {
  assert.equal(light['--bg'], THEME_COLORS.light);
  assert.equal(dark['--bg'], THEME_COLORS.dark);
});

test('text colours pass AA on every surface in both themes', () => {
  for (const [name, theme] of [['light', light], ['dark', dark]]) {
    const surfaces = [theme['--bg'], theme['--surface'], theme['--surface-2']];
    for (const token of ['--text', '--text-muted', '--link', '--success', '--danger', '--warning']) {
      for (const bg of surfaces) {
        assert.ok(contrastRatio(theme[token], bg) >= 4.5, `${name} ${token} ${theme[token]} on ${bg}`);
      }
    }
    for (const [fg, bg] of [['--on-accent', '--accent'], ['--on-success', '--success-solid'], ['--on-danger', '--danger-solid'], ['--on-neutral', '--neutral-solid']]) {
      assert.ok(contrastRatio(theme[fg], theme[bg]) >= 4.5, `${name} ${fg} on ${bg}`);
    }
  }
});

test('old variable names stay aliased for one release', () => {
  for (const legacy of ['--primary-color', '--accent-color', '--bg-color', '--card-bg', '--text-color', '--border-color']) {
    assert.ok(light[legacy], `${legacy} missing`);
  }
});

test('reduced motion turns transitions and animations off globally', () => {
  const all = ['tokens.css', 'base.css', 'components.css', 'utilities.css']
    .map((f) => fs.readFileSync(path.join(root, 'src', 'styles', f), 'utf8'))
    .join('\n');
  assert.match(all, /@media \(prefers-reduced-motion: reduce\)/);
});
