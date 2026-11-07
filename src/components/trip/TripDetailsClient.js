'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { tripReducer } from '@/lib/trip-reducer';
import { apiFetch } from '@/lib/api-client';
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

export default function TripDetailsClient({ initialTrip, initialTab }) {
  const [trip, dispatch] = useReducer(tripReducer, initialTrip);
  const [canEdit, setCanEdit] = useState(false);
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : TABS[0].id
  );

  useEffect(() => {
    apiFetch('/api/auth')
      .then((data) => setCanEdit(!!data.authenticated))
      .catch(() => setCanEdit(false));
  }, []);

  const changeTab = (id) => {
    setActiveTab(id);
    // Keep the tab in the URL so refresh / shared links land on the same tab.
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url);
  };

  const context = useMemo(() => ({ trip, dispatch, canEdit }), [trip, canEdit]);
  const Panel = PANELS[activeTab];

  return (
    <TripProvider value={context}>
      <EditModeBar canEdit={canEdit} onChange={setCanEdit} />
      <TripTabs active={activeTab} onChange={changeTab} />
      <div role="tabpanel" id={panelId(activeTab)} aria-labelledby={tabId(activeTab)}>
        <Panel />
      </div>
    </TripProvider>
  );
}
