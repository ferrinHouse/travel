import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessDeviceName } from '../src/lib/device-name.js';

test('names common devices for the passkey list', () => {
  const cases = {
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)': 'iPhone',
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)': 'iPad',
    'Mozilla/5.0 (Linux; Android 15; Pixel 9)': 'Android phone',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)': 'Mac',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)': 'Windows PC',
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)': 'Chromebook',
    'Mozilla/5.0 (X11; Linux x86_64)': 'Linux computer',
    '': 'Passkey',
  };
  for (const [ua, name] of Object.entries(cases)) assert.equal(guessDeviceName(ua), name, ua);
});

test('a short label for a session from its user agent', async () => {
  const { describeDevice } = await import('../src/lib/device-name.js');
  assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile Safari/604.1'), 'Safari on iPhone');
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0'), 'Edge on Windows PC');
  assert.equal(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/140.0'), 'Firefox on Mac');
  assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'), 'Chrome on Android phone');
  assert.equal(describeDevice(null), 'Unknown device');
});
