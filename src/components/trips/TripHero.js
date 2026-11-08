import { tagClass } from '@/lib/tags';
import { phaseLabel } from '@/lib/trip-status';

/** Gradient header for a trip page. Colours come from the [data-trip] wrapper. */
export default function TripHero({ trip, status }) {
  return (
    <header className="hero">
      <div className="hero-inner">
        <span className={`tag ${tagClass(trip.tag)}`}>{trip.tag}</span>
        <h1>{trip.name}</h1>
        {trip.description && <p>{trip.description}</p>}
        <div className="hero-meta">
          <span>{trip.dates}</span>
          {trip.travelers && (
            <>
              <span aria-hidden="true">•</span>
              <span>{trip.travelers}</span>
            </>
          )}
          <span className="hero-chip">{phaseLabel(status)}</span>
        </div>
      </div>
    </header>
  );
}
