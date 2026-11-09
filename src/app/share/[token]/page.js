import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { findSharedTrip } from '@/lib/api/share';
import { sharedPhotoUrl } from '@/lib/photos/view';
import TripStory from '@/components/story/TripStory';
import PrintButton from '@/components/story/PrintButton';
import { loadStory } from '@/components/story/loadStory';
import styles from '@/components/trips/trips.module.css';

export const revalidate = 0;

// Public, read-only story behind an unguessable link (no sign-in). Kept out of
// search engines, and the link never leaks to other sites through Referer.
const SHARED_META = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

async function sharedTrip(token) {
  const tripId = await findSharedTrip(prisma, token);
  return tripId ? loadStory(tripId) : null;
}

export async function generateMetadata({ params }) {
  const { token } = await params;
  const trip = await sharedTrip(token).catch(() => null);
  return { ...SHARED_META, title: trip ? trip.name : 'Link not found' };
}

export default async function SharedStoryPage({ params }) {
  const { token } = await params;
  const trip = await sharedTrip(token);
  if (!trip) notFound();

  return (
    <main className={`container ${styles.page}`}>
      <div className={`${styles.storyActions} no-print`}>
        <span className={styles.lede}>Shared with you by the Ferrins</span>
        <PrintButton />
      </div>
      <TripStory trip={trip} src={(photo, size) => sharedPhotoUrl(token, photo, size)} />
    </main>
  );
}
