// Fixed-window in-memory limiter. Fine for a single replica (the app runs
// exactly one pod because SQLite lives on NFS).
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const hits = new Map();

  function prune(t) {
    if (hits.size < 1000) return;
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }

  return {
    hit(key) {
      const t = now();
      prune(t);
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= t) {
        entry = { count: 0, resetAt: t + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return entry.count <= limit ? { allowed: true, retryAfterMs: 0 } : { allowed: false, retryAfterMs: entry.resetAt - t };
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
