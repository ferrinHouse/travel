import { tripTheme } from '@/lib/color';
import { tagClass } from '@/lib/tags';
import { groupByDay, photoAlt, storyStats } from '@/lib/photos/view';
import styles from './story.module.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The trip as a scrapbook: cover, numbers, then each day's plans and photos.
 * Used signed in (/trips/<id>/story) and on share links, so it only ever
 * shows the itinerary and photos, never logistics, checklists or meals.
 * `src(photo, size)` builds image URLs for whichever route serves them.
 */
export default function TripStory({ trip, src }) {
  const stats = storyStats(trip);
  const cover = trip.photos.find((p) => p.isCover) ?? trip.photos[0];
  const groups = groupByDay(trip.photos, trip.days);
  const photosFor = (day) => groups.find((g) => g.day?.dayNumber === day.dayNumber)?.photos ?? [];
  const other = groups.find((g) => g.day === null)?.photos ?? [];
  const days = trip.days.filter((d) => d.activities.length || photosFor(d).length || d.title);

  return (
    <article className={styles.story} data-trip={trip.id} style={tripTheme(trip)}>
      <header className={`hero ${cover ? 'hero-with-cover' : ''} ${styles.cover}`}>
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
            </div>
            <ul className={styles.stats} aria-label="The trip in numbers">
              <li>{plural(stats.days, 'day')}</li>
              <li>{plural(stats.photos, 'photo')}</li>
              <li>{plural(stats.activities, 'plan')}</li>
            </ul>
          </div>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element -- served by our own routes
            <img className="hero-cover" src={src(cover, 'lg')} alt={cover.caption || `${trip.name} cover photo`} />
          )}
        </div>
      </header>

      <div className={styles.body}>
        {days.length === 0 && other.length === 0 && (
          <p className={styles.empty}>Nothing to show yet: add plans or photos to the trip.</p>
        )}

        {days.map((day) => (
          <Day key={day.id} heading={day.dateLabel} title={day.title} activities={day.activities} photos={photosFor(day)} day={day} src={src} />
        ))}
        {other.length > 0 && <Day heading="More photos" activities={[]} photos={other} day={null} src={src} />}

        <footer className={styles.footer}>Made with 🧭 Family Adventures</footer>
      </div>
    </article>
  );
}

function Day({ heading, title, activities, photos, day, src }) {
  return (
    <section className={styles.day}>
      <h2 className={styles.dayHeading}>
        {heading}
        {title && <span className={styles.dayTitle}>{title}</span>}
      </h2>
      {activities.length > 0 && (
        <ul className={styles.plans}>
          {activities.map((a) => (
            <li key={a.id}>
              {a.time && <span className={styles.time}>{a.time}</span>}
              <span>{a.description}</span>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && (
        <div className={styles.photos}>
          {photos.map((photo, index) => (
            <figure key={photo.id} className={styles.figure}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own routes */}
              <img
                src={src(photo, 'lg')}
                srcSet={`${src(photo, 'sm')} 480w, ${src(photo, 'lg')} 1600w`}
                sizes="(max-width: 720px) 100vw, 30rem"
                alt={photoAlt(photo, day, index)}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
              />
              {photo.caption && <figcaption>{photo.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
