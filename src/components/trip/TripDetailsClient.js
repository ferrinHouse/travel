'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { tripReducer } from '@/lib/trip-reducer';
import { tripPermissions } from '@/lib/trip-permissions';
import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import { pendingTicks } from '@/components/offline/outbox';
import { patchAction } from '@/lib/offline/outbox-core';
import { TripProvider } from './TripContext';
import TripTabs, { TABS, panelId, tabId } from './TripTabs';
import EditModeBar from './EditModeBar';
import ItineraryTab from './itinerary/ItineraryTab';
import LogisticsTab from './logistics/LogisticsTab';
import ChecklistTab from './checklist/ChecklistTab';
import MealsTab from './meals/MealsTab';
import PhotosTab from './photos/PhotosTab';

const PANELS = {
  itinerary: ItineraryTab,
  logistics: LogisticsTab,
  checklist: ChecklistTab,
  meals: MealsTab,
  photos: PhotosTab,
};

const isBrowser = () => true;

/** `defaultTab`: where to land without ?tab= (photos for past trips). */
export default function TripDetailsClient({ initialTrip, initialTab, defaultTab = TABS[0].id, user }) {
  const [trip, dispatch] = useReducer(tripReducer, initialTrip);
  const [editMode, setEditMode] = useState(false);
  // Marks the page interactive (end-to-end tests wait for it before clicking).
  const hydrated = useBrowserFlag(isBrowser);
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : defaultTab
  );

  useEffect(() => {
    let cancelled = false;
    pendingTicks(initialTrip.id).then((ops) => {
      if (cancelled) return;
      // Show ticks made offline that haven't synced yet.
      for (const op of ops) dispatch(patchAction(op));
      // A saved (offline) copy was rendered for the tab open when it was saved;
      // follow the address instead.
      const fromUrl = new URL(window.location.href).searchParams.get('tab');
      if (fromUrl && TABS.some((t) => t.id === fromUrl)) setActiveTab(fromUrl);
    });
    return () => {
      cancelled = true;
    };
    // Once per page load; later ticks update the state directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (id) => {
    setActiveTab(id);
    // Keep the tab in the URL so refresh / shared links land on the same tab.
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url);
  };

  const permissions = useMemo(() => tripPermissions(user, editMode), [user, editMode]);
  const userId = user?.id ?? null;
  const context = useMemo(() => ({ trip, dispatch, userId, ...permissions }), [trip, userId, permissions]);
  const Panel = PANELS[activeTab];

  return (
    <TripProvider value={context}>
      <div data-hydrated={hydrated || undefined} hidden />
      <EditModeBar {...permissions} tripId={trip.id} editMode={editMode} onChange={setEditMode} />
      <TripTabs active={activeTab} onChange={changeTab} />
      <div role="tabpanel" id={panelId(activeTab)} aria-labelledby={tabId(activeTab)}>
        <Panel />
      </div>
    </TripProvider>
  );
}
