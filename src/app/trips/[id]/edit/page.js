import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/db';
import { can } from '@/lib/auth/roles';
import { getCurrentUser, requirePageUser } from '@/lib/auth/current-user';
import { tripFormValues } from '@/lib/trips/form';
import TripForm from '@/components/trips/TripForm';
import TripDangerZone from '@/components/trips/TripDangerZone';
import TripShare from '@/components/trips/TripShare';
import styles from '@/components/trips/trips.module.css';

export const revalidate = 0;

// No loading.js here: notFound() must be able to set a real 404 status.
const getTrip = (id) => prisma.trip.findUnique({ where: { id } });

export async function generateMetadata({ params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !can(user, 'edit')) return { title: 'Sign in' };
  const trip = await getTrip(id).catch(() => null);
  return { title: trip ? `Edit ${trip.name}` : 'Trip not found' };
}

export default async function EditTripPage({ params }) {
  const { id } = await params;
  await requirePageUser(`/trips/${encodeURIComponent(id)}/edit`, 'edit');
  const [trip, tags, shareLink] = await Promise.all([
    getTrip(id),
    prisma.trip.findMany({ distinct: ['tag'], select: { tag: true } }),
    prisma.tripShareLink.findFirst({ where: { tripId: id, revokedAt: null }, select: { createdAt: true } }),
  ]);
  if (!trip) notFound();

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className={styles.lede}>
          <Link href={`/trips/${trip.id}`}>← Back to {trip.name}</Link>
        </p>
        <h1 className={styles.title}>Trip settings</h1>
        <p className={styles.lede}>
          The web address stays <code>/trips/{trip.id}</code>.
        </p>
      </header>
      <TripForm mode="edit" tripId={trip.id} initial={tripFormValues(trip)} tags={tags.map((t) => t.tag)} />
      <TripShare tripId={trip.id} sharedSince={shareLink?.createdAt.toISOString() ?? null} />
      <TripDangerZone trip={{ id: trip.id, name: trip.name, archivedAt: trip.archivedAt }} />
    </main>
  );
}
