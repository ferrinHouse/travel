// Served at /manifest.webmanifest: lets phones install the site as an app.
// Relative import so tests/scripts/pwa-assets.test.mjs can load this file.
import { THEME_COLORS } from '../lib/theme.js';

export default function manifest() {
  return {
    name: 'Family Travel Adventures',
    short_name: 'Adventures',
    description: 'Itineraries, checklists and meal plans for our family trips, even without a signal.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
