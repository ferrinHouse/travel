import Link from 'next/link';
import { tripTheme } from '@/lib/color';
import { tagClass } from '@/lib/tags';
import { phaseLabel } from '@/lib/trip-status';

/** Dashboard card. `status` comes from tripPhase(). */
export default function TripCard({ trip, status }) {
  const past = status.phase === 'past';
  return (
    <article
      className={`card trip-card ${past ? 'trip-card-past' : ''}`}
      data-trip={trip.id}
      style={tripTheme(trip)}
      aria-labelledby={`trip-${trip.id}-name`}
    >
      <div className="trip-card-head">
        <h3 id={`trip-${trip.id}-name`}>{trip.name}</h3>
        <span className={`tag ${tagClass(trip.tag)}`}>{trip.tag}</span>
      </div>
      <span className="trip-card-dates">{trip.dates}</span>
      {trip.description && <p className="trip-card-desc">{trip.description}</p>}
      <div className="trip-card-foot">
        <span className={`countdown ${status.phase === 'active' ? 'countdown-live' : ''}`}>{phaseLabel(status)}</span>
        <Link href={`/trips/${trip.id}`} className={`btn ${past ? 'btn-ghost' : ''}`}>
          {past ? 'View Details' : 'View Itinerary'}
        </Link>
      </div>
    </article>
  );
}
