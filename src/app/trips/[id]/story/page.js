import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser, requirePageUser } from '@/lib/auth/current-user';
import { photoUrl } from '@/lib/photos/view';
import TripStory from '@/components/story/TripStory';
import PrintButton from '@/components/story/PrintButton';
import { loadStory } from '@/components/story/loadStory';
import styles from '@/components/trips/trips.module.css';

export const revalidate = 0;

// No loading.js here: notFound() must be able to set a real 404 status.

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (!(await getCurrentUser())) return { title: 'Sign in' };
  const trip = await loadStory(id).catch(() => null);
  return { title: trip ? `${trip.name}: the story` : 'Trip not found' };
}

export default async function TripStoryPage({ params }) {
  const { id } = await params;
  await requirePageUser(`/trips/${encodeURIComponent(id)}/story`);
  const trip = await loadStory(id);
  if (!trip) notFound();

  return (
    <main className={`container ${styles.page}`}>
      <div className={`${styles.storyActions} no-print`}>
        <Link href={`/trips/${trip.id}?tab=photos`}>← Back to {trip.name}</Link>
        <PrintButton />
      </div>
      <TripStory trip={trip} src={photoUrl} />
    </main>
  );
}
