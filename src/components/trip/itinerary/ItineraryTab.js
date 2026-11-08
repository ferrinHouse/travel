'use client';

import { useEffect, useRef } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { tripPhase } from '@/lib/trip-status';
import { useTrip } from '../TripContext';
import { useNowMinute } from '../useNowMinute';
import DayCard, { dayAnchor } from './DayCard';

export default function ItineraryTab() {
  const { trip } = useTrip();
  const now = useNowMinute();
  const status = now ? tripPhase(trip, now) : null;
  const todayNumber = status?.phase === 'active' ? status.dayNumber : null;
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null;

  // Mid-trip, jump to today once (unless today is already the first card).
  const scrolled = useRef(false);
  useEffect(() => {
    if (todayNumber == null || scrolled.current) return;
    scrolled.current = true;
    if (todayNumber === trip.days[0]?.dayNumber) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(dayAnchor(todayNumber))?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [todayNumber, trip.days]);

  if (trip.days.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="🗓️" title="No itinerary days yet." />
      </div>
    );
  }

  return (
    <div>
      {trip.days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          isToday={day.dayNumber === todayNumber}
          nowMinutes={day.dayNumber === todayNumber ? nowMinutes : null}
        />
      ))}
    </div>
  );
}
