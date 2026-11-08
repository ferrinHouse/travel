'use client';

import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

function subscribe(onChange) {
  const id = setInterval(onChange, 15_000);
  return () => clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / MINUTE);
// The server can't know the viewer's clock, so it renders without "today" highlights.
const getServerSnapshot = () => null;

/** The current time rounded down to the minute, or null during server render/hydration. */
export function useNowMinute() {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return minute == null ? null : new Date(minute * MINUTE);
}
