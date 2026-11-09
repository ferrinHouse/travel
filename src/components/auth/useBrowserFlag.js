'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** A browser-only boolean (false during server render), without a hydration mismatch. */
export function useBrowserFlag(check) {
  return useSyncExternalStore(subscribe, check, () => false);
}
