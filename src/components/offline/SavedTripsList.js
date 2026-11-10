'use client';

import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import { useSavedTrips } from './useOffline';
import styles from './offline.module.css';

const isBrowser = () => true;

/** The trips saved on this device, on the offline page. */
export default function SavedTripsList() {
  const ready = useBrowserFlag(isBrowser);
  const trips = Object.entries(useSavedTrips()).sort((a, b) => b[1].savedAt - a[1].savedAt);

  if (!ready) return null;
  if (trips.length === 0) {
    return <p>No trips are saved on this device yet. Next time you’re online, open a trip and choose “Save for offline”.</p>;
  }
  return (
    <>
      <h2 className="visually-hidden">Saved on this device</h2>
      <ul className={styles.savedList}>
        {trips.map(([id, trip]) => (
          <li key={id}>
            {/* A full page load, so the service worker serves the saved copy. */}
            <a className={styles.savedLink} href={`/trips/${id}`}>
              <span className={styles.savedName}>{trip.name}</span>
              {trip.dates && <span className={styles.savedMeta}>{trip.dates}</span>}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
