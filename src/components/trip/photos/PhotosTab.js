'use client';

import Link from 'next/link';
import { useState } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import { groupByDay, photoAlt, photoUrl } from '@/lib/photos/view';
import { useTrip } from '../TripContext';
import PhotoUploader from './PhotoUploader';
import Lightbox from './Lightbox';
import styles from './photos.module.css';

const groupId = (day) => `photos-day-${day ? day.dayNumber : 'other'}`;

/** Trip photos grouped by itinerary day; tap one to open the viewer. */
export default function PhotosTab() {
  const { trip, canUpload } = useTrip();
  const [openId, setOpenId] = useState(null);
  const groups = groupByDay(trip.photos, trip.days);
  // Viewer order = on-screen order.
  const ordered = groups.flatMap((g) => g.photos.map((photo, index) => ({ photo, day: g.day, index })));
  const count = trip.photos.length;

  return (
    <div>
      <div className={styles.head}>
        <h2 className={styles.title}>
          📷 Photos <span className="section-count">{count}</span>
        </h2>
        {count > 0 && (
          <Link href={`/trips/${trip.id}/story`} className="btn btn-outline">
            <span aria-hidden="true">📖</span> Trip story
          </Link>
        )}
      </div>

      {canUpload && <PhotoUploader />}

      {count === 0 ? (
        <div className="card">
          <EmptyState icon="📷" title="No photos yet.">
            {canUpload
              ? 'Add photos from the trip and they’ll be sorted onto the day they were taken.'
              : 'Photos from the trip will show up here.'}
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => (
          <section key={groupId(group.day)} className={styles.group} aria-labelledby={groupId(group.day)}>
            <h3 id={groupId(group.day)} className={styles.groupTitle}>
              {group.day ? group.day.dateLabel : 'Other photos'}
              {group.day?.title && <span className={styles.groupSub}>{group.day.title}</span>}
            </h3>
            <ul className={styles.grid}>
              {group.photos.map((photo, index) => (
                <li key={photo.id}>
                  <button type="button" className={styles.thumb} onClick={() => setOpenId(photo.id)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-protected files */}
                    <img
                      src={photoUrl(photo, 'sm')}
                      alt={photoAlt(photo, group.day, index)}
                      width={photo.width}
                      height={photo.height}
                      loading="lazy"
                      decoding="async"
                    />
                    {photo.isCover && <span className={styles.coverBadge}>Cover</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Lightbox items={ordered} openId={openId} onOpen={setOpenId} />
    </div>
  );
}
