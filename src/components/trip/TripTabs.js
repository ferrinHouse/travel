'use client';

import { useEffect, useRef } from 'react';

export const TABS = [
  { id: 'itinerary', label: '🗓️ Daily Itinerary' },
  { id: 'logistics', label: '✈️ Logistics' },
  { id: 'checklist', label: '✅ Packing & Tasks' },
  { id: 'meals', label: '🥣 Meals & Groceries' },
];

export const tabId = (id) => `trip-tab-${id}`;
export const panelId = (id) => `trip-panel-${id}`;

/** WAI-ARIA tablist: arrow keys / Home / End move between tabs. */
export default function TripTabs({ active, onChange }) {
  const refs = useRef({});

  // On narrow screens the tab bar scrolls sideways; keep the active tab visible.
  useEffect(() => {
    refs.current[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const focusTab = (index) => {
    const tab = TABS[(index + TABS.length) % TABS.length];
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  };

  const onKeyDown = (e) => {
    const index = TABS.findIndex((t) => t.id === active);
    if (e.key === 'ArrowRight') focusTab(index + 1);
    else if (e.key === 'ArrowLeft') focusTab(index - 1);
    else if (e.key === 'Home') focusTab(0);
    else if (e.key === 'End') focusTab(TABS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Trip sections" onKeyDown={onKeyDown}>
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={selected}
            aria-controls={panelId(tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`tab-btn ${selected ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
