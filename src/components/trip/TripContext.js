'use client';

import { createContext, useContext } from 'react';

/** { trip, dispatch, userId, canToggle, canAdd, canUpload, canEdit, isAdmin } for the trip detail page (see lib/trip-permissions). */
const TripContext = createContext(null);

export const TripProvider = TripContext.Provider;

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside <TripProvider>');
  return ctx;
}
