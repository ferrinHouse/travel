import Link from 'next/link';
import { tripTheme } from '@/lib/color';
import { tagClass } from '@/lib/tags';
import { phaseLabel } from '@/lib/trip-status';

/** Big card for the soonest (or current) trip on the dashboard. */
export default function FeaturedTrip({ trip, status }) {
  const live = status.phase === 'active';
  return (
    <article className="featured" data-featured data-trip={trip.id} style={tripTheme(trip)} aria-labelledby="featured-name">
      <div className="featured-art">
        <span className="featured-eyebrow">{live ? 'Happening now' : 'Next adventure'}</span>
        <h3 id="featured-name">{trip.name}</h3>
        <span>
          <span className={`tag ${tagClass(trip.tag)}`}>{trip.tag}</span>
        </span>
        <span className="featured-countdown">{phaseLabel(status)}</span>
      </div>
      <div className="featured-body">
        <span className="trip-card-dates">{trip.dates}</span>
        {trip.travelers && <span className="text-muted">{trip.travelers}</span>}
        {trip.description && <p>{trip.description}</p>}
        <Link href={`/trips/${trip.id}`} className="btn btn-block">
          {live ? "Open Today's Plan" : 'View Itinerary'}
        </Link>
      </div>
    </article>
  );
}
