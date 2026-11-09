'use client';

import { useMemo, useReducer, useState } from 'react';
import { tripReducer } from '@/lib/trip-reducer';
import { tripPermissions } from '@/lib/trip-permissions';
import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import { TripProvider } from './TripContext';
import TripTabs, { TABS, panelId, tabId } from './TripTabs';
import EditModeBar from './EditModeBar';
import ItineraryTab from './itinerary/ItineraryTab';
import LogisticsTab from './logistics/LogisticsTab';
import ChecklistTab from './checklist/ChecklistTab';
import MealsTab from './meals/MealsTab';

const PANELS = {
  itinerary: ItineraryTab,
  logistics: LogisticsTab,
  checklist: ChecklistTab,
  meals: MealsTab,
};

const isBrowser = () => true;

export default function TripDetailsClient({ initialTrip, initialTab, user }) {
  const [trip, dispatch] = useReducer(tripReducer, initialTrip);
  const [editMode, setEditMode] = useState(false);
  // Marks the page interactive (end-to-end tests wait for it before clicking).
  const hydrated = useBrowserFlag(isBrowser);
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : TABS[0].id
  );

  const changeTab = (id) => {
    setActiveTab(id);
    // Keep the tab in the URL so refresh / shared links land on the same tab.
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url);
  };

  const permissions = useMemo(() => tripPermissions(user, editMode), [user, editMode]);
  const context = useMemo(() => ({ trip, dispatch, ...permissions }), [trip, permissions]);
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
