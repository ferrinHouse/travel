// Turning a saved trip into the trip form's input values, and back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyTripForm, tripFormValues } from '../src/lib/trips/form.js';
import { validateTrip } from '../src/lib/trips/validation.js';
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from '../src/lib/color.js';

test('a new trip starts blank with the default colours', () => {
  const form = emptyTripForm();
  assert.equal(form.name, '');
  assert.equal(form.startDate, '');
  assert.equal(form.primaryColor, DEFAULT_PRIMARY);
  assert.equal(form.accentColor, DEFAULT_ACCENT);
});

test('a saved trip becomes strings for the inputs', () => {
  const form = tripFormValues({
    id: 'hawaii',
    name: 'Hawaii',
    tag: 'Island',
    travelers: 'Family of 6',
    description: null,
    startDate: new Date('2027-02-09T00:00:00Z'),
    endDate: '2027-02-19T00:00:00.000+00:00',
    primaryColor: '#0F766E',
    accentColor: 'junk',
  });
  assert.deepEqual(form, {
    name: 'Hawaii',
    tag: 'Island',
    travelers: 'Family of 6',
    description: '',
    startDate: '2027-02-09',
    endDate: '2027-02-19',
    primaryColor: '#0f766e',
    accentColor: DEFAULT_ACCENT,
  });
});

test('a trip with no dates leaves the date inputs empty', () => {
  const form = tripFormValues({ name: 'x', tag: 'x', travelers: 'x', startDate: null, endDate: null });
  assert.equal(form.startDate, '');
  assert.equal(form.endDate, '');
});

test('round trip: form values of a valid trip validate cleanly', () => {
  const form = tripFormValues({
    name: 'Boston', tag: 'City & Sea', travelers: 'Mike, Caron, Johnathan', description: 'Science!',
    startDate: new Date('2026-07-16T00:00:00Z'), endDate: new Date('2026-07-21T00:00:00Z'),
    primaryColor: '#1d4ed8', accentColor: '#b45309',
  });
  assert.deepEqual(validateTrip(form).errors, {});
});
