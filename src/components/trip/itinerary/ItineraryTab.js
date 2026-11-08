'use client';

import EmptyState from '@/components/ui/EmptyState';
import { useTrip } from '../TripContext';
import DayCard from './DayCard';

export default function ItineraryTab() {
  const { trip } = useTrip();

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
        <DayCard key={day.id} day={day} />
      ))}
    </div>
  );
}
