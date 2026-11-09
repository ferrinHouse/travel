const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION = {
  cookieName: 'travel_session',
  maxAgeDays: 90, // absolute lifetime
  idleDays: 30, // signed out after this long unused
  touchIntervalMs: 60 * 60 * 1000, // write lastSeenAt at most hourly
};

const time = (d) => new Date(d).getTime();

/** 'valid' | 'idle' | 'expired' */
export function sessionState(session, now = new Date()) {
  if (!session) return 'expired';
  const t = time(now);
  if (time(session.expiresAt) <= t) return 'expired';
  if (t - time(session.lastSeenAt) > SESSION.idleDays * DAY_MS) return 'idle';
  return 'valid';
}

export function shouldTouch(session, now = new Date()) {
  return time(now) - time(session.lastSeenAt) > SESSION.touchIntervalMs;
}

export const sessionExpiry = (now = new Date()) => new Date(time(now) + SESSION.maxAgeDays * DAY_MS);
