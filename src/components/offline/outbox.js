'use client';

// Checklist and grocery ticks go through this outbox: stored in IndexedDB, then
// sent. Without a connection they wait (and survive a reload) until the device
// is back online. Rules in src/lib/offline/outbox-core.js.
import { ApiError, apiFetch } from '@/lib/api-client';
import { isOp, opKey, outcome, pendingFor, requestFor } from '@/lib/offline/outbox-core';

const DB_NAME = 'travel-offline';
const STORE = 'outbox';

let userKey = null;
// Resolves once OfflineManager has said who is signed in (it may mount after
// a component that asks for waiting ticks).
let markUserKnown;
const userKnown = new Promise((resolve) => (markUserKnown = resolve));
const whenUserKnown = () => Promise.race([userKnown, new Promise((resolve) => setTimeout(resolve, 3000))]);
let state = { pending: 0, syncing: false, needsAuth: false };
const listeners = new Set();
const dropListeners = new Set();
let queue = Promise.resolve();

/** Who is signed in (set by OfflineManager); ticks are tagged with it. */
export function setOutboxUser(key) {
  userKey = key;
  markUserKnown();
  refresh();
}

/** For useSyncExternalStore: { pending, syncing, needsAuth }. */
export function subscribeOutbox(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export const outboxSnapshot = () => state;
export const OUTBOX_IDLE = { pending: 0, syncing: false, needsAuth: false };

/** Changes the server refused for good while syncing in the background. */
export function onDropped(fn) {
  dropListeners.add(fn);
  return () => dropListeners.delete(fn);
}

function setState(patch) {
  if (Object.entries(patch).every(([k, v]) => state[k] === v)) return;
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

// --- IndexedDB (records are ops with their key) --------------------------------

let dbPromise;
function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'));
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((err) => {
    dbPromise = undefined;
    throw err;
  });
  return dbPromise;
}

async function tx(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(work(store)).then((r) => (result = r), reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const request = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

export async function allOps() {
  try {
    const records = await tx('readonly', (store) => request(store.getAll()));
    return records.filter(isOp).sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

async function putOp(op) {
  await tx('readwrite', (store) => store.put({ ...op, key: opKey(op) }));
}

/** Deletes `op` unless a newer tick of the same item replaced it meanwhile. */
async function removeOp(op) {
  await tx('readwrite', async (store) => {
    const current = await request(store.get(opKey(op)));
    if (current && current.at === op.at) store.delete(opKey(op));
  });
}

/** Clears waiting changes: everyone's, or all but `keepUserKey`'s. */
export async function clearOutbox({ keepUserKey } = {}) {
  try {
    const ops = await allOps();
    await tx('readwrite', (store) => {
      for (const op of ops) if (op.userKey !== keepUserKey) store.delete(opKey(op));
    });
  } catch {
    // Nothing stored.
  }
  await refresh();
}

/** This person's waiting changes (for one trip, if given). */
export async function pendingTicks(tripId) {
  await whenUserKnown();
  return pendingFor(await allOps(), userKey, tripId);
}

async function refresh() {
  setState({ pending: (await pendingTicks()).length });
}

// --- Sending ---------------------------------------------------------------------

async function send(op) {
  const { url, method, body } = requestFor(op);
  try {
    await apiFetch(url, { method, body });
    return { outcome: 'done', status: 200 };
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return { outcome: outcome(status), status, message: err.message };
  }
}

async function run(awaitedKey) {
  const results = new Map();
  if (!userKey || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    await refresh();
    return results;
  }
  const ops = await pendingTicks();
  if (ops.length) setState({ syncing: true });
  let needsAuth = false;
  for (const op of ops) {
    const result = await send(op);
    results.set(opKey(op), result);
    if (result.outcome === 'done' || result.outcome === 'drop') await removeOp(op);
    if (result.outcome === 'drop' && opKey(op) !== awaitedKey) {
      for (const fn of dropListeners) fn(op, result);
    }
    if (result.outcome === 'auth') needsAuth = true;
    if (result.outcome === 'auth' || result.outcome === 'retry') break;
  }
  setState({ syncing: false, needsAuth });
  await refresh();
  return results;
}

/** Sends every waiting change, one sync at a time. */
export function flushOutbox(awaitedKey) {
  const next = queue.then(() => run(awaitedKey));
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Saves a tick: sent now if possible, otherwise kept until back online.
 * Resolves 'sent' or 'queued'; throws ApiError when the server refuses it.
 * `tick` = { kind: 'checklist' | 'grocery', id, tripId, value, label }.
 */
export async function saveTick(tick) {
  const op = { ...tick, userKey, at: Date.now() };
  if (!isOp(op)) return direct(op);
  try {
    await putOp(op);
  } catch {
    return direct(op); // no IndexedDB (e.g. some private modes): plain request
  }
  await refresh();
  const result = (await flushOutbox(opKey(op))).get(opKey(op));
  if (result?.outcome === 'done') return 'sent';
  if (result?.outcome === 'drop') throw new ApiError(result.message, result.status);
  return 'queued';
}

async function direct(op) {
  const { url, method, body } = requestFor(op);
  await apiFetch(url, { method, body });
  return 'sent';
}

