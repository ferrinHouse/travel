/** Lowercased username of 2–32 chars from a-z 0-9 . _ - ; otherwise null. */
export function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().toLowerCase();
  return /^[a-z0-9._-]{2,32}$/.test(name) ? name : null;
}

export function displayNameProblem(value) {
  if (typeof value !== 'string' || !value.trim()) return 'A display name is required.';
  if (value.trim().length > 60) return 'Keep the display name to 60 characters or fewer.';
  return null;
}
