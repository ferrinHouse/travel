import prisma from '@/lib/db';
import { tripPhase } from '@/lib/trip-status';
import EmptyState from '@/components/ui/EmptyState';
import TripCard from '@/components/trips/TripCard';
import FeaturedTrip from '@/components/trips/FeaturedTrip';
import { requirePageUser } from '@/lib/auth/current-user';

export const revalidate = 0; // Always render fresh so edits show immediately

async function getTrips() {
  try {
    return await prisma.trip.findMany();
  } catch (error) {
    console.error('Error fetching trips:', error);
    return [];
  }
}

const time = (value) => (value ? new Date(value).getTime() : Infinity);

export default async function DashboardPage() {
  await requirePageUser('/');
  const today = new Date();
  const trips = (await getTrips()).map((trip) => ({ trip, status: tripPhase(trip, today) }));

  // Soonest first; a trip stays upcoming through its last day.
  const upcoming = trips
    .filter((t) => t.status.phase !== 'past')
    .sort((a, b) => time(a.trip.startDate) - time(b.trip.startDate));
  // Most recent first.
  const past = trips
    .filter((t) => t.status.phase === 'past')
    .sort((a, b) => time(b.trip.endDate) - time(a.trip.endDate));
  const [featured, ...later] = upcoming;

  return (
    <>
      <header className="hero">
        <div className="hero-inner">
          <h1>Family Adventures</h1>
          <p>Our upcoming plans and past memories.</p>
        </div>
      </header>

      <main className="container">
        <section className="section" aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" className="section-title">
            Upcoming Trips <span className="section-count">{upcoming.length}</span>
          </h2>
          {featured ? (
            <>
              <FeaturedTrip trip={featured.trip} status={featured.status} />
              {later.length > 0 && (
                <div className="grid">
                  {later.map(({ trip, status }) => (
                    <TripCard key={trip.id} trip={trip} status={status} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <EmptyState icon="🧳" title="No upcoming trips planned yet." />
            </div>
          )}
        </section>

        <section className="section" aria-labelledby="past-title">
          <h2 id="past-title" className="section-title">
            Past Adventures <span className="section-count">{past.length}</span>
          </h2>
          {past.length === 0 ? (
            <div className="card">
              <EmptyState icon="📷" title="No past adventures recorded." />
            </div>
          ) : (
            <div className="grid">
              {past.map(({ trip, status }) => (
                <TripCard key={trip.id} trip={trip} status={status} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
