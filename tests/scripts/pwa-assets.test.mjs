// The install manifest and its icons: browsers silently refuse to offer
// "Add to Home Screen" when an icon is missing or the wrong size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import manifest from '../../src/app/manifest.js';
import { THEME_COLORS } from '../../src/lib/theme.js';
import { ROOT } from '../support/test-db.mjs';

const m = manifest();

test('the manifest describes an installable, standalone app that opens on the dashboard', () => {
  assert.equal(m.name, 'Family Travel Adventures');
  assert.ok(m.short_name && m.short_name.length <= 12, 'short name fits under a home-screen icon');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.equal(m.display, 'standalone');
  assert.equal(m.theme_color, THEME_COLORS.light);
  assert.equal(m.background_color, THEME_COLORS.light);
});

test('it lists 192px and 512px icons plus a maskable one, and each file matches its size', async () => {
  const sizes = m.icons.map((i) => `${i.sizes}${i.purpose === 'maskable' ? ' maskable' : ''}`).sort();
  assert.deepEqual(sizes, ['192x192', '512x512', '512x512 maskable']);
  for (const icon of m.icons) {
    const file = path.join(ROOT, 'public', icon.src);
    assert.ok(fs.existsSync(file), `${icon.src} missing`);
    assert.equal(icon.type, 'image/png');
    const meta = await sharp(file).metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes, icon.src);
    assert.equal(meta.format, 'png');
  }
});

test('the home-screen icon for iPhones and the browser-tab icon exist', async () => {
  const apple = await sharp(path.join(ROOT, 'src', 'app', 'apple-icon.png')).metadata();
  assert.equal(`${apple.width}x${apple.height}`, '180x180');
  assert.equal(apple.hasAlpha, false, 'iOS fills transparent corners with black');
  assert.match(fs.readFileSync(path.join(ROOT, 'src', 'app', 'icon.svg'), 'utf8'), /^<svg[^>]+viewBox="0 0 512 512"/);
});

test('the service worker files are plain public scripts', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
  assert.match(sw, /importScripts\('\/sw-core\.js'\)/);
  assert.ok(fs.existsSync(path.join(ROOT, 'public', 'sw-core.js')));
});
