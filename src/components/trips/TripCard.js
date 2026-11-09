import Link from 'next/link';
import { tripTheme } from '@/lib/color';
import { tagClass } from '@/lib/tags';
import { phaseLabel } from '@/lib/trip-status';

/**
 * Dashboard card. `status` comes from tripPhase(). `preview` (the trip form)
 * renders no link. `coverSrc`: the trip's cover photo, shown across the top.
 */
export default function TripCard({ trip, status, preview = false, coverSrc }) {
  const past = status.phase === 'past';
  return (
    <article
      className={`card trip-card ${past ? 'trip-card-past' : ''} ${coverSrc ? 'trip-card-with-cover' : ''}`}
      data-trip={trip.id}
      style={tripTheme(trip)}
      aria-labelledby={`trip-${trip.id}-name`}
    >
      {coverSrc && (
        // Decorative: the card's heading already names the trip.
        // eslint-disable-next-line @next/next/no-img-element -- private, cookie-protected files
        <img className="trip-card-cover" src={coverSrc} alt="" loading="lazy" decoding="async" />
      )}
      <div className="trip-card-head">
        <h3 id={`trip-${trip.id}-name`}>{trip.name}</h3>
        <span className={`tag ${tagClass(trip.tag)}`}>{trip.tag}</span>
      </div>
      <span className="trip-card-dates">{trip.dates}</span>
      {trip.description && <p className="trip-card-desc">{trip.description}</p>}
      <div className="trip-card-foot">
        <span className={`countdown ${status.phase === 'active' ? 'countdown-live' : ''}`}>{phaseLabel(status)}</span>
        {preview ? (
          <span className={`btn ${past ? 'btn-ghost' : ''}`} aria-hidden="true">
            {past ? 'View Details' : 'View Itinerary'}
          </span>
        ) : (
          <Link href={`/trips/${trip.id}`} className={`btn ${past ? 'btn-ghost' : ''}`}>
            {past ? 'View Details' : 'View Itinerary'}
          </Link>
        )}
      </div>
    </article>
  );
}
