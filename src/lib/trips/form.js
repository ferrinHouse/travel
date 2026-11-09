// Values for the trip form's inputs (all strings; dates as 'YYYY-MM-DD').
import { DEFAULT_ACCENT, DEFAULT_PRIMARY, normalizeHex } from '../color.js';
import { dayKey, parseDay } from './dates.js';

export function emptyTripForm() {
  return {
    name: '',
    tag: '',
    travelers: '',
    description: '',
    startDate: '',
    endDate: '',
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
  };
}

export function tripFormValues(trip) {
  const day = (value) => {
    const parsed = parseDay(value);
    return parsed ? dayKey(parsed) : '';
  };
  return {
    name: trip.name ?? '',
    tag: trip.tag ?? '',
    travelers: trip.travelers ?? '',
    description: trip.description ?? '',
    startDate: day(trip.startDate),
    endDate: day(trip.endDate),
    primaryColor: normalizeHex(trip.primaryColor, DEFAULT_PRIMARY),
    accentColor: normalizeHex(trip.accentColor, DEFAULT_ACCENT),
  };
}
