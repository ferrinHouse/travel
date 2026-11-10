// Loads public/sw-core.js (a classic script the service worker pulls in with
// importScripts) into a sandbox, the way the worker sees it.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './test-db.mjs';

// Arrays and objects made inside the sandbox have that realm's prototypes,
// which deepStrictEqual treats as different; copy them into this realm.
const local = (value) => (value !== null && typeof value === 'object' && !(value instanceof Response) && !(value instanceof Headers) ? JSON.parse(JSON.stringify(value)) : value);

export function loadSwCore() {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'sw-core.js'), 'utf8');
  const sandbox = { self: {}, URL, Headers, Response };
  vm.runInNewContext(source, sandbox, { filename: 'sw-core.js' });
  const api = {};
  for (const [name, value] of Object.entries(sandbox.self.TravelSW)) {
    api[name] = typeof value === 'function' ? (...args) => local(value(...args)) : local(value);
  }
  return api;
}
