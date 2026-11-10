'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { isSavedCopy, parseSavedTrips } from '@/lib/offline/state';
import { OUTBOX_IDLE, outboxSnapshot, subscribeOutbox } from './outbox';
import { isOfflinePage, savedTripsSnapshot, subscribeSavedTrips } from './worker';

// Browser-only state for the offline components, read without hydration
// mismatches (the server render always sees "online, nothing saved").

function subscribeOnline(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

export const useOutbox = () => useSyncExternalStore(subscribeOutbox, outboxSnapshot, () => OUTBOX_IDLE);

const noSubscribe = () => () => {};

/** { [tripId]: { name, dates, savedAt } } saved on this device. */
export function useSavedTrips() {
  const raw = useSyncExternalStore(subscribeSavedTrips, savedTripsSnapshot, () => null);
  return useMemo(() => parseSavedTrips(raw), [raw]);
}

// Decided once per page load: a page that has been open a while is not a saved copy.
const savedCopyAtLoad = new Map();
function savedCopySnapshot(renderedAt) {
  if (!savedCopyAtLoad.has(renderedAt)) {
    savedCopyAtLoad.set(renderedAt, isSavedCopy(renderedAt, Date.now()) && !isOfflinePage());
  }
  return savedCopyAtLoad.get(renderedAt);
}

/** Whether this page came from the offline copy rather than the server. */
export const useSavedCopy = (renderedAt) =>
  useSyncExternalStore(noSubscribe, () => savedCopySnapshot(renderedAt), () => false);

/** The offline page says it all itself; the strip stays out of its way. */
export const useOnOfflinePage = () => useSyncExternalStore(noSubscribe, isOfflinePage, () => false);
