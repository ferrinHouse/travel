'use client';

import { createContext, useContext } from 'react';

/** { trip, dispatch, canEdit } for the trip detail page. */
const TripContext = createContext(null);

export const TripProvider = TripContext.Provider;

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>');
  return ctx;
}
