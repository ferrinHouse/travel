import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  THEME_STORAGE_KEY,
  THEME_COLORS,
  parseThemePreference,
  resolveTheme,
  themeInitScript,
} from '../src/lib/theme.js';

/** Runs the inline <head> script against a fake browser and returns <html>'s state. */
function runInitScript({ stored, systemDark = false, storageThrows = false } = {}) {
  const root = { dataset: {}, style: {} };
  const context = {
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error('SecurityError');
        return key === THEME_STORAGE_KEY ? stored ?? null : null;
      },
    },
    matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' && systemDark }),
    document: { documentElement: root },
  };
  vm.runInNewContext(themeInitScript, context);
  return root;
}

describe('theme preference', () => {
  test('parseThemePreference only accepts known values', () => {
    assert.equal(parseThemePreference('dark'), 'dark');
    assert.equal(parseThemePreference('light'), 'light');
    assert.equal(parseThemePreference('system'), 'system');
    for (const bad of [null, undefined, '', 'DARK', 'blue']) assert.equal(parseThemePreference(bad), 'system');
  });

  test('resolveTheme follows the system only when set to system', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
  });

  test('theme colours exist for both themes', () => {
    assert.match(THEME_COLORS.light, /^#[0-9a-f]{6}$/);
    assert.match(THEME_COLORS.dark, /^#[0-9a-f]{6}$/);
  });
});

describe('themeInitScript (runs before first paint)', () => {
  test('no saved choice follows the system', () => {
    assert.equal(runInitScript({ systemDark: true }).dataset.theme, 'dark');
    const light = runInitScript({ systemDark: false });
    assert.equal(light.dataset.theme, 'light');
    assert.equal(light.dataset.themePref, 'system');
    assert.equal(light.style.colorScheme, 'light');
  });

  test('a saved choice wins over the system', () => {
    const root = runInitScript({ stored: 'dark', systemDark: false });
    assert.equal(root.dataset.theme, 'dark');
    assert.equal(root.dataset.themePref, 'dark');
    assert.equal(root.style.colorScheme, 'dark');
    assert.equal(runInitScript({ stored: 'light', systemDark: true }).dataset.theme, 'light');
  });

  test('a garbage saved value is treated as system', () => {
    assert.equal(runInitScript({ stored: '"><script>', systemDark: true }).dataset.theme, 'dark');
  });

  test('blocked storage falls back to light without throwing', () => {
    assert.equal(runInitScript({ storageThrows: true, systemDark: true }).dataset.theme, 'light');
  });
});
