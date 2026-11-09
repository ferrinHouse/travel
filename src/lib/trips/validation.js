// Trip details from the trip form. The form runs this for inline errors; the
// API runs it again as the real check.
import { normalizeHex } from '../color.js';
import { MAX_TRIP_DAYS, formatDateRange, parseDay, tripLength } from './dates.js';

export const LIMITS = { name: 80, tag: 40, travelers: 80, description: 1000 };

const LABELS = { name: 'Trip name', tag: 'Trip type', travelers: 'Who’s going', description: 'Description' };

/**
 * → { value, errors }. `errors` maps field name → message and is empty when
 * the input is valid. `value` has trimmed text, midnight-UTC dates, '#rrggbb'
 * colours (or null for "default") and a display `dates` string.
 */
export function validateTrip(input) {
  const body = input !== null && typeof input === 'object' ? input : {};
  const errors = {};
  const value = {};

  for (const field of ['name', 'tag', 'travelers']) {
    const v = cleanText(body[field]);
    if (v === undefined) errors[field] = `${LABELS[field]} must be text.`;
    else if (!v) errors[field] = `${LABELS[field]} is required.`;
    else if (v.length > LIMITS[field]) errors[field] = `${LABELS[field]} can be at most ${LIMITS[field]} characters.`;
    else value[field] = v;
  }

  const description = cleanText(body.description ?? '');
  if (description === undefined) errors.description = 'Description must be text.';
  else if (description.length > LIMITS.description) errors.description = `Description can be at most ${LIMITS.description} characters.`;
  else value.description = description || null;

  const start = parseDay(body.startDate);
  const end = parseDay(body.endDate);
  if (!start) errors.startDate = 'Choose a start date.';
  if (!end) errors.endDate = 'Choose an end date.';
  if (start && end) {
    if (end < start) errors.endDate = 'The end date must be on or after the start date.';
    else if (tripLength(start, end) > MAX_TRIP_DAYS) errors.endDate = `Trips can be at most ${MAX_TRIP_DAYS} days long.`;
    else Object.assign(value, { startDate: start, endDate: end, dates: formatDateRange(start, end) });
  }

  for (const field of ['primaryColor', 'accentColor']) {
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') {
      value[field] = null;
      continue;
    }
    const hex = normalizeHex(raw);
    if (hex) value[field] = hex;
    else errors[field] = 'Pick a colour.';
  }

  return { value, errors };
}

/** Trimmed string; undefined for non-strings (so they're rejected, not coerced). */
function cleanText(v) {
  if (v === undefined || v === null) return '';
  return typeof v === 'string' ? v.trim() : undefined;
}
