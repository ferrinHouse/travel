// Trip calendar days. A trip's dates are stored as midnight UTC, so every
// calculation and format here works in UTC and never depends on the server's
// or browser's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The longest trip the planner will scaffold. */
export const MAX_TRIP_DAYS = 60;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 'YYYY-MM-DD' (from a date input), a Date, or a stored ISO timestamp →
 * a midnight-UTC Date. Anything else, or an impossible date, → null.
 */
export function parseDay(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : midnight(value);
  }
  if (typeof value !== 'string') return null;
  const match = ISO_DAY.exec(value) ?? /^(\d{4})-(\d{2})-(\d{2})T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, dd] = match.slice(1, 4).map(Number);
  const date = new Date(Date.UTC(y, m - 1, dd));
  // Date.UTC rolls 2026-02-30 over to March; reject instead.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== dd) return null;
  return date;
}

function midnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** 'YYYY-MM-DD' (the value a date input expects). */
export function dayKey(date) {
  return midnight(new Date(date)).toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return new Date(midnight(new Date(date)).getTime() + days * DAY_MS);
}

/** Number of calendar days from start to end, counting both. */
export function tripLength(start, end) {
  return Math.round((midnight(new Date(end)) - midnight(new Date(start))) / DAY_MS) + 1;
}

const fmt = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options });
const MONTH_DAY = fmt({ month: 'long', day: 'numeric' });
const FULL = fmt({ month: 'long', day: 'numeric', year: 'numeric' });
const DAY_ONLY = fmt({ day: 'numeric' });
const YEAR = fmt({ year: 'numeric' });
const WEEKDAY_MONTH_DAY = fmt({ weekday: 'long', month: 'long', day: 'numeric' });

/**
 * 'February 7, 2025' · 'June 20 – 25, 2026' · 'June 28 – July 3, 2026' ·
 * 'December 30, 2026 – January 2, 2027'
 */
export function formatDateRange(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (dayKey(a) === dayKey(b)) return FULL.format(a);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${FULL.format(a)} – ${FULL.format(b)}`;
  const year = YEAR.format(b);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${MONTH_DAY.format(a)} – ${DAY_ONLY.format(b)}, ${year}`;
  return `${MONTH_DAY.format(a)} – ${MONTH_DAY.format(b)}, ${year}`;
}

/** 'Day 1: Sunday, June 21' */
export function dayLabel(date, dayNumber) {
  return `Day ${dayNumber}: ${WEEKDAY_MONTH_DAY.format(new Date(date))}`;
}
