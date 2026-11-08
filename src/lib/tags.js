/** Colour class for a trip's tag badge ('City & Sea' → 'tag-city'). */
export function tagClass(tag) {
  const clean = String(tag ?? '').toLowerCase();
  if (clean.includes('city')) return 'tag-city';
  if (clean.includes('beach')) return 'tag-beach';
  if (clean.includes('island')) return 'tag-island';
  if (clean.includes('nature') || clean.includes('park')) return 'tag-nature';
  return 'tag-sea';
}
