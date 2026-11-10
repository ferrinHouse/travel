'use client';

import { useEffect } from 'react';
import { isSavedCopy, userChange } from '@/lib/offline/state';
import { clearOutbox, flushOutbox, setOutboxUser } from './outbox';
import { forgetSavedPages, isOfflinePage, registerWorker, saveFirstPage, setStoredUserKey, storedUserKey } from './worker';

/**
 * Starts offline support on every page: registers the service worker, makes
 * sure the device only holds the signed-in person's offline data, and sends
 * waiting ticks whenever the connection comes back.
 */
export default function OfflineManager({ userKey, renderedAt }) {
  useEffect(() => {
    setOutboxUser(userKey);
    registerWorker().then((registration) => registration && userKey && saveFirstPage());

    // Only a fresh page from the server says who is signed in now; the offline
    // page and saved copies may be stale (or signed-out renders).
    const fresh = navigator.onLine && !isSavedCopy(renderedAt, Date.now()) && !isOfflinePage();
    if (fresh) {
      const change = userChange(storedUserKey(), userKey);
      (async () => {
        if (change === 'switch' || change === 'signed-out') await forgetSavedPages();
        if (change === 'switch' || change === 'set') await clearOutbox({ keepUserKey: userKey });
        if (change !== 'keep') setStoredUserKey(userKey);
        flushOutbox();
      })();
    } else {
      flushOutbox();
    }

    const sync = () => flushOutbox();
    const onVisible = () => document.visibilityState === 'visible' && flushOutbox();
    window.addEventListener('online', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userKey, renderedAt]);

  return null;
}
