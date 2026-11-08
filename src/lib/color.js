// Colour maths for per-trip theming. Pure, so node --test can load it.
// Contrast follows WCAG 2.x relative luminance.

/** Backgrounds text can sit on, per theme: --surface, --bg, --surface-2 in src/styles/tokens.css. */
export const SURFACES = {
  light: ['#ffffff', '#f4f6f8', '#eaeef2'],
  dark: ['#161b22', '#0d1117', '#1f2630'],
};

const DEFAULT_PRIMARY = '#2c3e50';
const DEFAULT_ACCENT = '#3498db';
const WHITE = '#ffffff';
const INK = '#111827';

/** '#abc' / 'AABBCC' / ' #aabbcc ' → '#aabbcc'; anything else → fallback. */
export function normalizeHex(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return fallback;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex}`;
}

function toRgb(value) {
  const hex = normalizeHex(value);
  if (!hex) throw new TypeError(`Not a hex colour: ${value}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text colour for a background: white unless the colour is light enough
 * that white can't be rescued by darkening it a little (contrast < 3).
 */
export function contrastText(bg) {
  if (contrastRatio(WHITE, bg) >= 3) return WHITE;
  return contrastRatio(WHITE, bg) >= contrastRatio(INK, bg) ? WHITE : INK;
}

/** Linear sRGB mix: t = 0 → a, t = 1 → b. */
export function mixHex(a, b, t) {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex(ca.map((c, i) => c + (cb[i] - c) * t));
}

/**
 * Nudges `color` towards black (on light backgrounds) or white (on dark ones)
 * until it reaches `min` contrast against every background.
 */
export function ensureContrast(color, backgrounds, min = 4.5) {
  const passes = (c) => backgrounds.every((bg) => contrastRatio(c, bg) >= min);
  if (passes(color)) return color;
  const avg = backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length;
  const target = avg > 0.18 ? '#000000' : WHITE;
  for (let step = 1; step <= 50; step++) {
    const candidate = mixHex(color, target, step / 50);
    if (passes(candidate)) return candidate;
  }
  return target;
}

/**
 * CSS custom properties for a trip's colours, each adjusted just enough to
 * pass WCAG AA (4.5:1) wherever it's used. Values are always '#rrggbb', so
 * they are safe to put in a style attribute.
 */
export function tripTheme(trip) {
  const primary = normalizeHex(trip?.primaryColor, DEFAULT_PRIMARY);
  const accent = normalizeHex(trip?.accentColor, DEFAULT_ACCENT);

  const onHero = contrastText(primary);
  const hero = ensureContrast(primary, [onHero]);
  const heroEnd = mixHex(hero, onHero === WHITE ? '#000000' : WHITE, 0.35);

  const onAccent = contrastText(accent);
  const accentStrong = ensureContrast(accent, [onAccent]);

  return {
    '--trip-primary': primary,
    '--trip-accent': accent,
    '--trip-hero': hero,
    '--trip-hero-end': heroEnd,
    '--trip-on-hero': onHero,
    '--trip-accent-strong': accentStrong,
    '--trip-on-accent': onAccent,
    '--trip-ink-light': ensureContrast(accent, SURFACES.light),
    '--trip-ink-dark': ensureContrast(accent, SURFACES.dark),
    '--trip-heading-light': ensureContrast(primary, SURFACES.light),
    '--trip-heading-dark': ensureContrast(primary, SURFACES.dark),
  };
}
