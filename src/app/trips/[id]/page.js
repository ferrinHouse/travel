import { cache } from 'react';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { tripTheme } from '@/lib/color';
import { tripPhase } from '@/lib/trip-status';
import TripHero from '@/components/trips/TripHero';
import TripDetailsClient from '@/components/trip/TripDetailsClient';
import SaveOffline from '@/components/offline/SaveOffline';
import Link from 'next/link';
import { can } from '@/lib/auth/roles';
import { getCurrentUser, requirePageUser, clientUser } from '@/lib/auth/current-user';
import { clientPhoto, PHOTO_ORDER } from '@/lib/photos/client-photo';
import { photoUrl } from '@/lib/photos/view';

export const revalidate = 0; // Always render fresh so edits show immediately

// cache() so generateMetadata and the page share one query per request.
const getTripDetails = cache(async (id) => {
  try {
    return await prisma.trip.findUnique({
      where: { id },
      include: {
        checklist: { orderBy: { id: 'asc' } },
        logistics: { orderBy: { order: 'asc' } },
        days: {
          orderBy: { dayNumber: 'asc' },
          include: { activities: { orderBy: { order: 'asc' } } },
        },
        meals: true,
        groceries: { orderBy: { id: 'asc' } },
        photos: { orderBy: PHOTO_ORDER },
      },
    });
  } catch (error) {
    console.error('Error fetching trip details:', error);
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  if (!(await getCurrentUser())) return { title: 'Sign in' };
  const trip = await getTripDetails(id);
  if (!trip) return { title: 'Trip not found' };
  return { title: trip.name, description: trip.description || `${trip.name}: ${trip.dates}` };
}

export default async function TripDetailsPage({ params, searchParams }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await requirePageUser(`/trips/${encodeURIComponent(id)}`);
  const trip = await getTripDetails(id);

  if (!trip) {
    notFound();
  }

  // Only what the client needs; raw colours and other fields stay on the server.
  const { startDate, endDate, status, days, meals, checklist, logistics, groceries } = trip;
  const photos = trip.photos.map(clientPhoto);
  const clientTrip = { id: trip.id, startDate, endDate, status, days, meals, checklist, logistics, groceries, photos };
  const phase = tripPhase(trip);
  const cover = trip.photos.find((p) => p.isCover);

  return (
    <div data-trip={trip.id} style={tripTheme(trip)}>
      <TripHero trip={trip} status={phase} cover={cover && { src: photoUrl(cover, 'lg'), alt: cover.caption || `${trip.name} cover photo` }} />
      <main className="container has-tabbar">
        {trip.archivedAt && (
          <p className="notice">
            <span>🗄️ This trip is archived, so it&apos;s tucked away on the home page.</span>
            {can(user, 'edit') && <Link href={`/trips/${trip.id}/edit`}>Restore it</Link>}
          </p>
        )}
        <SaveOffline trip={{ id: trip.id, name: trip.name, dates: trip.dates ?? '' }} />
        <TripDetailsClient
          initialTrip={clientTrip}
          initialTab={typeof tab === 'string' ? tab : undefined}
          defaultTab={phase.phase === 'past' ? 'photos' : 'itinerary'}
          user={clientUser(user)}
        />
      </main>
    </div>
  );
}
