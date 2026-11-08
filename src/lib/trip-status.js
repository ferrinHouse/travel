// Where "today" falls relative to a trip. Trip dates are stored as midnight-UTC
// calendar dates; "today" is the viewer's local calendar date (matches isTripPast).

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as 'YYYY-MM-DD'. */
export function localDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDayIndex(value) {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS;
}

function localDayIndex(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

/**
 * { phase: 'upcoming', daysUntil } | { phase: 'active', dayNumber, totalDays } | { phase: 'past', daysAgo }
 * daysUntil / daysAgo are null when the trip has no dates.
 */
export function tripPhase(trip, today = new Date()) {
  if (!trip.endDate) {
    return trip.status === 'past' ? { phase: 'past', daysAgo: null } : { phase: 'upcoming', daysUntil: null };
  }
  const end = utcDayIndex(trip.endDate);
  const start = trip.startDate ? utcDayIndex(trip.startDate) : end;
  const now = localDayIndex(today);

  if (now < start) return { phase: 'upcoming', daysUntil: start - now };
  if (now > end) return { phase: 'past', daysAgo: now - end };
  return { phase: 'active', dayNumber: now - start + 1, totalDays: end - start + 1 };
}

export function phaseLabel(status) {
  if (status.phase === 'active') {
    return status.totalDays === 1 ? 'Today!' : `Day ${status.dayNumber} of ${status.totalDays}`;
  }
  if (status.phase === 'past') return 'Trip complete';
  if (status.daysUntil == null) return 'Coming up';
  return status.daysUntil === 1 ? 'Tomorrow!' : `In ${status.daysUntil} days`;
}
