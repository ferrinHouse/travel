import { tagClass } from '@/lib/tags';
import { phaseLabel } from '@/lib/trip-status';

/**
 * Gradient header for a trip page. Colours come from the [data-trip] wrapper.
 * A cover photo sits beside the text as a framed print (never behind it, so
 * the text keeps its checked contrast against the trip colours).
 */
export default function TripHero({ trip, status, cover }) {
  return (
    <header className={`hero ${cover ? 'hero-with-cover' : ''}`}>
      <div className="hero-inner">
        <div className="hero-text">
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
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- private, cookie-protected files
          <img className="hero-cover" src={cover.src} alt={cover.alt} />
        )}
      </div>
    </header>
  );
}
