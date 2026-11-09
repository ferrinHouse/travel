import Link from 'next/link';
import prisma from '@/lib/db';
import { tripPhase } from '@/lib/trip-status';
import { can } from '@/lib/auth/roles';
import EmptyState from '@/components/ui/EmptyState';
import TripCard from '@/components/trips/TripCard';
import FeaturedTrip from '@/components/trips/FeaturedTrip';
import { requirePageUser } from '@/lib/auth/current-user';
import styles from '@/components/trips/trips.module.css';

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
  const user = await requirePageUser('/');
  const canPlan = can(user, 'edit');
  const today = new Date();
  const all = (await getTrips()).map((trip) => ({ trip, status: tripPhase(trip, today) }));
  const trips = all.filter((t) => !t.trip.archivedAt);
  const archived = all
    .filter((t) => t.trip.archivedAt)
    .sort((a, b) => time(b.trip.endDate) - time(a.trip.endDate));

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
          <div className={styles.sectionHead}>
            <h2 id="upcoming-title" className="section-title">
              Upcoming Trips <span className="section-count">{upcoming.length}</span>
            </h2>
            {canPlan && (
              <Link href="/trips/new" className="btn">
                <span aria-hidden="true">＋</span> Plan a trip
              </Link>
            )}
          </div>
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

        {archived.length > 0 && (
          <section className="section" aria-labelledby="archived-title">
            <details className={styles.archived}>
              <summary>
                <h2 id="archived-title" className="section-title">
                  Archived <span className="section-count">{archived.length}</span>
                </h2>
              </summary>
              <div className="grid">
                {archived.map(({ trip, status }) => (
                  <TripCard key={trip.id} trip={trip} status={status} />
                ))}
              </div>
            </details>
          </section>
        )}
      </main>
    </>
  );
}
