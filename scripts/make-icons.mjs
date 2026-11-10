// Draws the app icon (a compass on the brand blue) and writes every size the
// browsers and home screens need. Run once after changing the design:
//   node scripts/make-icons.mjs
// Output (committed): src/app/icon.svg, src/app/apple-icon.png,
// public/icons/icon-192.png, icon-512.png, maskable-512.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLUE = '#0b62b8'; // --accent in tokens.css (light theme)
const GOLD = '#ffb347';
const WHITE = '#ffffff';

/** `rounded`: transparent corners for browser icons; square for maskable/iOS. */
const svg = ({ rounded }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="${BLUE}"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="${WHITE}" stroke-width="28"/>
  <g transform="rotate(40 256 256)">
    <path d="M256 120 L294 256 L218 256 Z" fill="${GOLD}"/>
    <path d="M256 392 L294 256 L218 256 Z" fill="${WHITE}"/>
  </g>
  <circle cx="256" cy="256" r="20" fill="${BLUE}" stroke="${WHITE}" stroke-width="8"/>
</svg>
`;

const write = (rel, data) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log('wrote', rel);
};

const png = (source, size, { flatten = false } = {}) => {
  let image = sharp(Buffer.from(source)).resize(size, size);
  if (flatten) image = image.flatten({ background: BLUE });
  return image.png({ compressionLevel: 9 }).toBuffer();
};

const rounded = svg({ rounded: true });
const square = svg({ rounded: false });

write('src/app/icon.svg', rounded);
write('public/icons/icon-192.png', await png(rounded, 192));
write('public/icons/icon-512.png', await png(rounded, 512));
// Maskable: full bleed; the compass sits inside the 80% safe zone.
write('public/icons/maskable-512.png', await png(square, 512));
// iOS fills transparency with black, so no alpha here.
write('src/app/apple-icon.png', await png(square, 180, { flatten: true }));
