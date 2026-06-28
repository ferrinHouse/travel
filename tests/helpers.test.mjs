import test from 'node:test';
import assert from 'node:assert';
import { 
  parseTimeToMinutes, 
  getMealIcon, 
  renderMarkdown, 
  isTripPast 
} from '../src/lib/helpers.js';

test('parseTimeToMinutes should parse standard time formats correctly', () => {
  // AM / PM formats
  assert.strictEqual(parseTimeToMinutes('8:00 AM'), 480);
  assert.strictEqual(parseTimeToMinutes('12:00 PM'), 720);
  assert.strictEqual(parseTimeToMinutes('12:30 PM'), 750);
  assert.strictEqual(parseTimeToMinutes('05:30 PM'), 1050);
  assert.strictEqual(parseTimeToMinutes('12:05 AM'), 5);
  
  // Case insensitivity & padding
  assert.strictEqual(parseTimeToMinutes('  9:15 am  '), 555);
  assert.strictEqual(parseTimeToMinutes('10:45 pm'), 1365);
});

test('parseTimeToMinutes should parse qualitative time slots correctly', () => {
  assert.strictEqual(parseTimeToMinutes('Morning walk'), 480);
  assert.strictEqual(parseTimeToMinutes('At noon'), 720);
  assert.strictEqual(parseTimeToMinutes('Afternoon hike'), 840);
  assert.strictEqual(parseTimeToMinutes('Evening dinner'), 1080);
  assert.strictEqual(parseTimeToMinutes('Night cap'), 1200);
});

test('parseTimeToMinutes should return high fallback for empty/unknown times', () => {
  assert.strictEqual(parseTimeToMinutes(''), 9999);
  assert.strictEqual(parseTimeToMinutes(null), 9999);
  assert.strictEqual(parseTimeToMinutes('Some random string'), 9990);
});

test('getMealIcon should return correct emoji', () => {
  assert.strictEqual(getMealIcon('Breakfast'), '🥣');
  assert.strictEqual(getMealIcon('Lunch'), '🥪');
  assert.strictEqual(getMealIcon('Dinner'), '🍽️');
  assert.strictEqual(getMealIcon('Unknown'), '🍽️'); // Default
});

test('renderMarkdown should escape HTML and render markdown elements', () => {
  // Bold & Italic
  assert.strictEqual(
    renderMarkdown('This is **bold** and *italic* text.'),
    'This is <strong>bold</strong> and <em>italic</em> text.'
  );

  // Hyperlinks
  assert.strictEqual(
    renderMarkdown('Go to [Google](https://google.com).'),
    'Go to <a href="https://google.com" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; font-weight: 500;">Google</a>.'
  );

  // HTML escaping
  assert.strictEqual(
    renderMarkdown('Check out <script>alert(1)</script> & enjoy!'),
    'Check out &lt;script&gt;alert(1)&lt;/script&gt; &amp; enjoy!'
  );
});

test('isTripPast should check trip status based on endDate vs today', () => {
  const mockToday = new Date('2026-06-25T12:00:00Z');

  // Trip in the future
  const futureTrip = { endDate: '2026-06-26T00:00:00Z', status: 'upcoming' };
  assert.strictEqual(isTripPast(futureTrip, mockToday), false);

  // Trip ending today (is not past yet)
  const todayTrip = { endDate: '2026-06-25T00:00:00Z', status: 'upcoming' };
  assert.strictEqual(isTripPast(todayTrip, mockToday), false);

  // Trip in the past
  const pastTrip = { endDate: '2026-06-24T00:00:00Z', status: 'upcoming' };
  assert.strictEqual(isTripPast(pastTrip, mockToday), true);

  // Fallback check
  const fallbackPast = { endDate: null, status: 'past' };
  assert.strictEqual(isTripPast(fallbackPast, mockToday), true);
  
  const fallbackFuture = { endDate: null, status: 'upcoming' };
  assert.strictEqual(isTripPast(fallbackFuture, mockToday), false);
});
