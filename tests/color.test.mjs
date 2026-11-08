import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHex,
  contrastRatio,
  contrastText,
  mixHex,
  ensureContrast,
  tripTheme,
  SURFACES,
} from '../src/lib/color.js';

// Every colour pair used by the seeded trips plus some awkward ones.
const SEEDED = [
  ['#004488', '#d9534f'],
  ['#2c7a7b', '#ed8936'],
  ['#2c3e50', '#d4a017'],
  ['#2c3e50', '#3498db'],
];
const AWKWARD = [
  ['#f1c40f', '#ffff00'], // light primary, neon accent
  ['#ffffff', '#ffffff'],
  ['#000000', '#000000'],
  ['#808080', '#777777'],
];

describe('normalizeHex', () => {
  test('accepts 3 and 6 digit hex with or without #', () => {
    assert.equal(normalizeHex('#ABC'), '#aabbcc');
    assert.equal(normalizeHex('abc'), '#aabbcc');
    assert.equal(normalizeHex(' #00Aa88 '), '#00aa88');
  });

  test('returns the fallback for anything else', () => {
    for (const bad of [null, undefined, '', 'red', '#12', '#1234567', 'url(x)', '#ggg', 42]) {
      assert.equal(normalizeHex(bad, '#123456'), '#123456', String(bad));
    }
    assert.equal(normalizeHex('nope'), null);
  });
});

describe('contrastRatio', () => {
  test('matches the WCAG reference values', () => {
    assert.equal(contrastRatio('#000000', '#ffffff').toFixed(2), '21.00');
    assert.equal(contrastRatio('#ffffff', '#ffffff').toFixed(2), '1.00');
    // #767676 is the classic "just passes 4.5:1 on white" grey.
    assert.ok(contrastRatio('#767676', '#ffffff') >= 4.5);
    assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
  });

  test('accepts short hex and rejects junk', () => {
    assert.equal(contrastRatio('#fff', '#000').toFixed(2), '21.00');
    assert.throws(() => contrastRatio('red', '#000'), TypeError);
  });

  test('is symmetric', () => {
    assert.equal(contrastRatio('#004488', '#d9534f'), contrastRatio('#d9534f', '#004488'));
  });
});

describe('contrastText', () => {
  test('picks white on dark and near-black on light', () => {
    assert.equal(contrastText('#004488'), '#ffffff');
    assert.equal(contrastText('#f1c40f'), '#111827');
    assert.equal(contrastText('#ffffff'), '#111827');
  });
});

describe('mixHex', () => {
  test('mixes linearly in sRGB', () => {
    assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
    assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  });
});

describe('ensureContrast', () => {
  test('leaves colours that already pass alone', () => {
    assert.equal(ensureContrast('#004488', ['#ffffff']), '#004488');
  });

  test('darkens on light backgrounds and lightens on dark ones until it passes', () => {
    const onLight = ensureContrast('#d9534f', SURFACES.light);
    for (const bg of SURFACES.light) assert.ok(contrastRatio(onLight, bg) >= 4.5, `${onLight} on ${bg}`);
    assert.ok(contrastRatio(onLight, '#000000') < contrastRatio('#d9534f', '#000000'), 'got darker');

    const onDark = ensureContrast('#004488', SURFACES.dark);
    for (const bg of SURFACES.dark) assert.ok(contrastRatio(onDark, bg) >= 4.5, `${onDark} on ${bg}`);
  });

  test('supports a custom minimum', () => {
    const c = ensureContrast('#aaaaaa', ['#ffffff'], 3);
    assert.ok(contrastRatio(c, '#ffffff') >= 3);
    assert.ok(contrastRatio(c, '#ffffff') < 4.5, 'does not overshoot far past the target');
  });
});

describe('tripTheme', () => {
  test('falls back to the site palette for missing or bad colours', () => {
    const vars = tripTheme({ primaryColor: null, accentColor: 'javascript:alert(1)' });
    assert.match(vars['--trip-primary'], /^#[0-9a-f]{6}$/);
    assert.match(vars['--trip-accent'], /^#[0-9a-f]{6}$/);
    for (const value of Object.values(vars)) assert.match(value, /^#[0-9a-f]{6}$/);
  });

  for (const [primaryColor, accentColor] of [...SEEDED, ...AWKWARD]) {
    test(`every text/background pair passes AA for ${primaryColor} / ${accentColor}`, () => {
      const v = tripTheme({ primaryColor, accentColor });
      // Hero text over both ends of the hero gradient.
      assert.ok(contrastRatio(v['--trip-on-hero'], v['--trip-hero']) >= 4.5, 'hero start');
      assert.ok(contrastRatio(v['--trip-on-hero'], v['--trip-hero-end']) >= 4.5, 'hero end');
      // Button text on the accent button.
      assert.ok(contrastRatio(v['--trip-on-accent'], v['--trip-accent-strong']) >= 4.5, 'button');
      // Accent used as text (times, headings) on each theme's surfaces.
      for (const bg of SURFACES.light) assert.ok(contrastRatio(v['--trip-ink-light'], bg) >= 4.5, `ink on ${bg}`);
      for (const bg of SURFACES.dark) assert.ok(contrastRatio(v['--trip-ink-dark'], bg) >= 4.5, `dark ink on ${bg}`);
      // Primary used as heading text.
      for (const bg of SURFACES.light) assert.ok(contrastRatio(v['--trip-heading-light'], bg) >= 4.5, `heading on ${bg}`);
      for (const bg of SURFACES.dark) assert.ok(contrastRatio(v['--trip-heading-dark'], bg) >= 4.5, `dark heading on ${bg}`);
    });
  }

  test('keeps the trip colour when it already passes', () => {
    const v = tripTheme({ primaryColor: '#004488', accentColor: '#d9534f' });
    assert.equal(v['--trip-primary'], '#004488');
    assert.equal(v['--trip-hero'], '#004488');
    assert.equal(v['--trip-heading-light'], '#004488');
  });
});
