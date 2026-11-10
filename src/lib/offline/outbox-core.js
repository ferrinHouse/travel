// Ticks made without a connection wait in an outbox (IndexedDB, see
// src/components/offline/outbox.js) until they can be sent. These are the pure
// rules; each change sets an explicit value, so only the latest tick per item
// matters and replaying it twice is harmless.

/** What can wait offline: the reducer list, the API route and the field. */
const KINDS = {
  checklist: { list: 'checklist', url: '/api/checklist', field: 'isCompleted' },
  grocery: { list: 'groceries', url: '/api/grocery', field: 'isBought' },
};

/**
 * op = { kind, id, tripId, value, label, userKey, at }
 * `label` is the item's text (for messages), `userKey` who ticked it.
 */
export function isOp(op) {
  return (
    !!op &&
    Object.hasOwn(KINDS, op.kind) &&
    Number.isInteger(op.id) &&
    op.id > 0 &&
    typeof op.value === 'boolean' &&
    typeof op.tripId === 'string' &&
    op.tripId.length > 0 &&
    typeof op.userKey === 'string' &&
    op.userKey.length > 0
  );
}

export const opKey = (op) => `${op.kind}:${op.id}`;

/** Adds `op`, replacing any older change to the same item. */
export function upsert(ops, op) {
  const key = opKey(op);
  return [...ops.filter((o) => opKey(o) !== key), op];
}

/** This person's waiting changes, optionally for one trip. */
export function pendingFor(ops, userKey, tripId) {
  if (!userKey) return [];
  return ops.filter((o) => o.userKey === userKey && (tripId === undefined || o.tripId === tripId));
}

/** The trip as it will be once its waiting changes are sent. */
export function applyOps(trip, ops) {
  let next = trip;
  for (const op of ops) {
    if (op.tripId !== trip.id) continue;
    const { list, field } = KINDS[op.kind];
    const items = next[list] ?? [];
    if (!items.some((item) => item.id === op.id)) continue;
    next = { ...next, [list]: items.map((item) => (item.id === op.id ? { ...item, [field]: op.value } : item)) };
  }
  return next;
}

/** The trip reducer action that shows this change. */
export function patchAction(op) {
  return { type: `${op.kind}/patch`, id: op.id, patch: { [KINDS[op.kind].field]: op.value } };
}

/**
 * The request a tick makes online, plus `queuedBy`: the server refuses it if
 * someone else is signed in by the time it is sent.
 */
export function requestFor(op) {
  const { url, field } = KINDS[op.kind];
  return { url, method: 'POST', body: { id: op.id, [field]: op.value, queuedBy: op.userKey } };
}

/**
 * What to do with a waiting change after trying to send it (status 0 = no
 * connection): 'done', 'retry' later, 'auth' (wait for sign-in), or 'drop'.
 */
export function outcome(status) {
  if (status >= 200 && status < 300) return 'done';
  if (status === 401) return 'auth';
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'retry';
  return 'drop';
}
