'use client';

import { useEffect } from 'react';
import { needsRefresh } from '@/lib/offline/state';
import { offlineSupported, saveTripOffline, savedTrips } from './worker';

/**
 * On the dashboard: quietly keeps trips that are under way or coming up soon
 * saved for offline, refreshing each copy at most every 12 hours.
 * `trips` = [{ id, name, dates, photos }].
 */
export default function AutoSaveTrips({ trips }) {
  const ids = trips.map((t) => t.id).join(',');

  useEffect(() => {
    if (!offlineSupported() || !trips.length) return undefined;
    let cancelled = false;
    // Let the page finish loading first.
    const timer = setTimeout(async () => {
      for (const trip of trips) {
        if (cancelled || !navigator.onLine) return;
        if (!needsRefresh(savedTrips()[trip.id], Date.now())) continue;
        try {
          await saveTripOffline(trip, trip.photos);
        } catch {
          // Try again on the next visit.
        }
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `ids` stands in for the trips list, which is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return null;
}
