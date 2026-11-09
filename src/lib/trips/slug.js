// A trip's id is its address: /trips/<slug>. Slugs are chosen once, when the
// trip is created, and never change (links and bookmarks keep working).

export const SLUG_MAX = 40;

/** Words the app uses (or will use) for its own pages under /trips. */
export const RESERVED_SLUGS = ['new', 'edit', 'admin', 'api', 'share', 'story', 'archive', 'archived'];

const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 'Montréal Café!' → 'montreal-cafe'. May return '' when nothing usable is left. */
export function slugify(name) {
  if (typeof name !== 'string') return '';
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return trimTo(slug, SLUG_MAX);
}

function trimTo(slug, max) {
  return slug.length <= max ? slug : slug.slice(0, max).replace(/-+$/, '');
}

/** Why a slug can't be used, or null if it's fine. */
export function slugProblem(slug) {
  if (typeof slug !== 'string' || slug.length < 2) return 'The web address needs at least 2 characters.';
  if (slug.length > SLUG_MAX) return `The web address can be at most ${SLUG_MAX} characters.`;
  if (!SHAPE.test(slug)) return 'Use lowercase letters and numbers, with single dashes between words.';
  if (RESERVED_SLUGS.includes(slug)) return `“${slug}” is reserved for the app. Try another web address.`;
  return null;
}

/** `base`, or `base-2`, `base-3`… — the first one not in `taken` and not reserved. */
export function uniqueSlug(base, taken) {
  const free = (slug) => !taken.has(slug) && !RESERVED_SLUGS.includes(slug);
  if (free(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = trimTo(base, SLUG_MAX - suffix.length) + suffix;
    if (free(candidate)) return candidate;
  }
}
