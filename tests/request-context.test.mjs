import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { appConfig, clientIp, requestInfo, readQuery } from '../src/lib/api/request-context.js';

const headers = (obj) => new Headers(obj);

describe('appConfig (from environment variables)', () => {
  test('production with an https origin', () => {
    const config = appConfig({ APP_ORIGIN: 'https://travel.example.com/', SETUP_TOKEN: 's3t', NODE_ENV: 'production' });
    assert.deepEqual(config, {
      origin: 'https://travel.example.com',
      rpID: 'travel.example.com',
      rpName: 'Family Travel Adventures',
      setupToken: 's3t',
      secureCookies: true,
    });
  });

  test('explicit RP id and name win; blank setup token means none', () => {
    const config = appConfig({ APP_ORIGIN: 'https://trips.example.com', WEBAUTHN_RP_ID: 'example.com', WEBAUTHN_RP_NAME: 'Ferrins', SETUP_TOKEN: '  ' });
    assert.equal(config.rpID, 'example.com');
    assert.equal(config.rpName, 'Ferrins');
    assert.equal(config.setupToken, null);
  });

  test('plain http origins (local e2e) do not get Secure cookies', () => {
    assert.equal(appConfig({ APP_ORIGIN: 'http://localhost:3100', NODE_ENV: 'production' }).secureCookies, false);
  });

  test('without APP_ORIGIN the request decides the origin, and production stays secure', () => {
    const config = appConfig({ NODE_ENV: 'production' }, { host: 'travel.local:8080', proto: 'https' });
    assert.equal(config.origin, 'https://travel.local:8080');
    assert.equal(config.rpID, 'travel.local');
    assert.equal(config.secureCookies, true);
    assert.equal(appConfig({ NODE_ENV: 'development' }, { host: 'localhost:3000', proto: 'http' }).secureCookies, false);
  });

  test('a junk APP_ORIGIN is a configuration error', () => {
    assert.throws(() => appConfig({ APP_ORIGIN: 'not a url' }), /APP_ORIGIN/);
  });
});

describe('clientIp', () => {
  test('first X-Forwarded-For hop from the reverse proxy', () => {
    assert.equal(clientIp(headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.2' })), '198.51.100.4');
  });
  test('falls back to X-Real-IP, then unknown', () => {
    assert.equal(clientIp(headers({ 'x-real-ip': '198.51.100.9' })), '198.51.100.9');
    assert.equal(clientIp(headers({})), 'unknown');
  });
});

describe('requestInfo', () => {
  test('collects what handlers and the origin check need', () => {
    const info = requestInfo({
      method: 'post',
      headers: headers({ origin: 'https://a.example', host: 'a.example', 'user-agent': 'UA', 'x-forwarded-proto': 'https', 'x-forwarded-for': '1.2.3.4' }),
    });
    assert.deepEqual(info, { method: 'POST', origin: 'https://a.example', host: 'a.example', proto: 'https', userAgent: 'UA', ip: '1.2.3.4' });
  });

  test('prefers X-Forwarded-Host behind the proxy and defaults proto to http', () => {
    const info = requestInfo({ method: 'GET', headers: headers({ host: 'pod:3000', 'x-forwarded-host': 'travel.example.com' }) });
    assert.equal(info.host, 'travel.example.com');
    assert.equal(info.proto, 'http');
    assert.equal(info.origin, null);
  });
});

describe('readQuery', () => {
  test('turns GET query strings into a body object', () => {
    assert.deepEqual(readQuery('https://x/api/auth/invite?token=abc&x=1'), { token: 'abc', x: '1' });
    assert.equal(readQuery('https://x/api/users'), null);
  });
});
