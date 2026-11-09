'use client';

import { useEffect, useRef } from 'react';

export const TABS = [
  { id: 'itinerary', icon: '🗓️', label: 'Daily Itinerary', short: 'Itinerary' },
  { id: 'logistics', icon: '✈️', label: 'Logistics', short: 'Logistics' },
  { id: 'checklist', icon: '✅', label: 'Packing & Tasks', short: 'Packing' },
  { id: 'meals', icon: '🥣', label: 'Meals & Groceries', short: 'Meals' },
  { id: 'photos', icon: '📷', label: 'Photos', short: 'Photos' },
];

export const tabId = (id) => `trip-tab-${id}`;
export const panelId = (id) => `trip-panel-${id}`;

/**
 * WAI-ARIA tablist: arrow keys / Home / End move between tabs. Inline under
 * the hero on wide screens; a fixed bottom bar on phones (see components.css).
 */
export default function TripTabs({ active, onChange }) {
  const listRef = useRef(null);
  const refs = useRef({});

  // If the inline bar overflows sideways, keep the active tab in view
  // (scrolling only the bar, never the page).
  useEffect(() => {
    const list = listRef.current;
    const tab = refs.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2 });
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
    <div ref={listRef} className="tabs" role="tablist" aria-label="Trip sections" onKeyDown={onKeyDown}>
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
            <span className="tab-icon" aria-hidden="true">
              {tab.icon}
            </span>{' '}
            <span className="tab-label">{tab.label}</span>
            <span className="tab-short">{tab.short}</span>
          </button>
        );
      })}
    </div>
  );
}
