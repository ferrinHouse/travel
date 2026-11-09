import { cache } from 'react';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { tripTheme } from '@/lib/color';
import { tripPhase } from '@/lib/trip-status';
import TripHero from '@/components/trips/TripHero';
import TripDetailsClient from '@/components/trip/TripDetailsClient';
import Link from 'next/link';
import { can } from '@/lib/auth/roles';
import { getCurrentUser, requirePageUser, clientUser } from '@/lib/auth/current-user';

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
  const clientTrip = { id: trip.id, startDate, endDate, status, days, meals, checklist, logistics, groceries };

  return (
    <div data-trip={trip.id} style={tripTheme(trip)}>
      <TripHero trip={trip} status={tripPhase(trip)} />
      <main className="container has-tabbar">
        {trip.archivedAt && (
          <p className="notice">
            <span>🗄️ This trip is archived, so it&apos;s tucked away on the home page.</span>
            {can(user, 'edit') && <Link href={`/trips/${trip.id}/edit`}>Restore it</Link>}
          </p>
        )}
        <TripDetailsClient initialTrip={clientTrip} initialTab={typeof tab === 'string' ? tab : undefined} user={clientUser(user)} />
      </main>
    </div>
  );
}
