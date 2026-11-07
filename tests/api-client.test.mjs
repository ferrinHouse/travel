import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, ApiError } from '../src/lib/api-client.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return calls;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch', () => {
  test('GET without a body sends no JSON header', async () => {
    const calls = stubFetch(() => json(200, { authenticated: true }));
    assert.deepEqual(await apiFetch('/api/auth'), { authenticated: true });
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.headers, undefined);
    assert.equal(calls[0].init.body, undefined);
  });

  test('sends JSON bodies with the right header', async () => {
    const calls = stubFetch(() => json(200, { success: true, item: { id: 1 } }));
    const data = await apiFetch('/api/checklist', { method: 'POST', body: { id: 1, isCompleted: true } });
    assert.deepEqual(data.item, { id: 1 });
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].init.body, '{"id":1,"isCompleted":true}');
  });

  test('uses the server message on error responses', async () => {
    stubFetch(() => json(400, { success: false, message: 'Text is required' }));
    await assert.rejects(apiFetch('/x', { method: 'POST', body: {} }), (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Text is required');
      return true;
    });
  });

  test('treats success:false as an error even with a 200', async () => {
    stubFetch(() => json(200, { success: false, message: 'Nope' }));
    await assert.rejects(apiFetch('/x'), { name: 'ApiError', message: 'Nope', status: 200 });
  });

  test('401 without a message explains edit mode', async () => {
    stubFetch(() => new Response('', { status: 401 }));
    await assert.rejects(apiFetch('/x'), { status: 401, message: /unlock editing/ });
  });

  test('non-JSON error bodies get a generic message with the status', async () => {
    stubFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    await assert.rejects(apiFetch('/x'), { status: 502, message: 'Request failed (502).' });
  });

  test('network failures become a friendly ApiError with status 0', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    await assert.rejects(apiFetch('/x'), { name: 'ApiError', status: 0, message: /Network error/ });
  });
});
