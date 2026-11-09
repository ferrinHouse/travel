// Trip slugs (the /trips/<slug> address) and form validation shared by the
// trip form (inline errors) and the API (the real check).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RESERVED_SLUGS, slugProblem, slugify, uniqueSlug } from '../src/lib/trips/slug.js';
import { validateTrip } from '../src/lib/trips/validation.js';
import { STARTER_CHECKLIST } from '../src/lib/trips/checklist-templates.js';
import { CHECKLIST_BASE } from '../src/lib/categories.js';

describe('slugify', () => {
  test('lowercase words joined by dashes', () => {
    assert.equal(slugify('Chicago Museums & Pizza!'), 'chicago-museums-pizza');
    assert.equal(slugify('  Sioux   Falls  '), 'sioux-falls');
  });

  test('accents are dropped, not lost', () => {
    assert.equal(slugify('Montréal Café'), 'montreal-cafe');
  });

  test('keeps it short without a trailing dash', () => {
    const slug = slugify('The Great Big Southwest National Parks Road Trip Extravaganza');
    assert.ok(slug.length <= 40, slug);
    assert.ok(!slug.endsWith('-'));
  });

  test('nothing usable gives an empty string', () => {
    assert.equal(slugify('🌴🌴'), '');
    assert.equal(slugify(null), '');
  });
});

describe('slugProblem', () => {
  test('good slugs pass', () => {
    for (const ok of ['hawaii', 'sioux-falls', 'boston-2026', 'nyc']) assert.equal(slugProblem(ok), null, ok);
  });

  test('bad shapes are explained', () => {
    for (const bad of ['', 'a', 'Has Caps', 'trailing-', '-leading', 'double--dash', 'under_score', 'x'.repeat(41), 42]) {
      assert.ok(slugProblem(bad), String(bad));
    }
  });

  test('words the app uses for its own pages are reserved', () => {
    for (const word of ['new', 'edit', 'admin', 'api', 'share']) {
      assert.ok(RESERVED_SLUGS.includes(word));
      assert.match(slugProblem(word), /reserved/);
    }
  });
});

describe('uniqueSlug', () => {
  test('adds -2, -3… only when needed', () => {
    assert.equal(uniqueSlug('boston', new Set()), 'boston');
    assert.equal(uniqueSlug('boston', new Set(['boston'])), 'boston-2');
    assert.equal(uniqueSlug('boston', new Set(['boston', 'boston-2'])), 'boston-3');
  });

  test('reserved words get a suffix too', () => {
    assert.equal(uniqueSlug('new', new Set()), 'new-2');
  });

  test('stays within the length limit', () => {
    const base = 'x'.repeat(40);
    const slug = uniqueSlug(base, new Set([base]));
    assert.equal(slugProblem(slug), null, slug);
  });
});

const good = {
  name: 'Lake Week',
  tag: 'Beach',
  travelers: 'Family of 6',
  description: 'Cabin by the lake.',
  startDate: '2027-07-01',
  endDate: '2027-07-07',
  primaryColor: '#2C7A7B',
  accentColor: 'ed8936',
};

describe('validateTrip', () => {
  test('clean input comes back normalised', () => {
    const { value, errors } = validateTrip(good);
    assert.deepEqual(errors, {});
    assert.equal(value.name, 'Lake Week');
    assert.equal(value.startDate.toISOString(), '2027-07-01T00:00:00.000Z');
    assert.equal(value.endDate.toISOString(), '2027-07-07T00:00:00.000Z');
    assert.equal(value.primaryColor, '#2c7a7b');
    assert.equal(value.accentColor, '#ed8936');
    assert.equal(value.dates, 'July 1 – 7, 2027');
  });

  test('text is trimmed; an empty description becomes null', () => {
    const { value } = validateTrip({ ...good, name: '  Lake Week ', description: '   ' });
    assert.equal(value.name, 'Lake Week');
    assert.equal(value.description, null);
  });

  test('required fields', () => {
    const { errors } = validateTrip({});
    for (const field of ['name', 'tag', 'travelers', 'startDate', 'endDate']) assert.ok(errors[field], field);
  });

  test('length limits', () => {
    const { errors } = validateTrip({ ...good, name: 'x'.repeat(81), tag: 'x'.repeat(41), travelers: 'x'.repeat(81), description: 'x'.repeat(1001) });
    assert.deepEqual(Object.keys(errors).sort(), ['description', 'name', 'tag', 'travelers']);
  });

  test('the end cannot be before the start', () => {
    const { errors } = validateTrip({ ...good, endDate: '2027-06-30' });
    assert.match(errors.endDate, /after the start/i);
  });

  test('at most 60 days', () => {
    assert.deepEqual(validateTrip({ ...good, endDate: '2027-08-29' }).errors, {}); // 60 days
    assert.match(validateTrip({ ...good, endDate: '2027-08-30' }).errors.endDate, /60 days/);
  });

  test('impossible dates are rejected', () => {
    assert.ok(validateTrip({ ...good, startDate: '2027-02-30' }).errors.startDate);
  });

  test('colours must be hex; blank means "use the default"', () => {
    assert.ok(validateTrip({ ...good, primaryColor: 'red' }).errors.primaryColor);
    assert.ok(validateTrip({ ...good, accentColor: 'url(x)' }).errors.accentColor);
    const { value, errors } = validateTrip({ ...good, primaryColor: '', accentColor: undefined });
    assert.deepEqual(errors, {});
    assert.equal(value.primaryColor, null);
    assert.equal(value.accentColor, null);
  });

  test('non-string junk is rejected, not coerced', () => {
    const { errors } = validateTrip({ ...good, name: 42, tag: ['Beach'] });
    assert.ok(errors.name);
    assert.ok(errors.tag);
  });

  test('not an object at all', () => {
    assert.ok(Object.keys(validateTrip(null).errors).length > 0);
  });
});

describe('starter checklist', () => {
  test('has items in every built-in category, with no duplicates', () => {
    const texts = STARTER_CHECKLIST.map((i) => i.text);
    assert.equal(new Set(texts).size, texts.length);
    for (const category of CHECKLIST_BASE) {
      assert.ok(STARTER_CHECKLIST.some((i) => i.category === category), category);
    }
  });
});
