import Link from 'next/link';
import prisma from '@/lib/db';

export const revalidate = 0; // Disable caching to ensure updates are instantly visible

async function getTrips() {
  try {
    return await prisma.trip.findMany();
  } catch (error) {
    console.error('Error fetching trips:', error);
    return [];
  }
}

export default async function DashboardPage() {
  const trips = await getTrips();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Determine if a trip has finished based on dates
  const isTripPast = (trip) => {
    if (trip.endDate) {
      const tripEnd = new Date(trip.endDate);
      tripEnd.setHours(23, 59, 59, 999);
      return tripEnd < today;
    }
    return trip.status === 'past'; // Fallback
  };

  const upcoming = trips.filter(trip => !isTripPast(trip));
  const past = trips.filter(trip => isTripPast(trip));

  // Sort upcoming chronologically ascending (closest trip first)
  const upcomingTrips = upcoming.sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate) - new Date(b.startDate);
  });

  // Sort past chronologically descending (most recent past adventure first)
  const pastTrips = past.sort((a, b) => {
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return new Date(b.endDate) - new Date(a.endDate);
  });

  const getTagClass = (tag) => {
    const cleanTag = tag.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (cleanTag.includes('city')) return 'tag-city';
    if (cleanTag.includes('beach')) return 'tag-beach';
    if (cleanTag.includes('island')) return 'tag-island';
    if (cleanTag.includes('nature') || cleanTag.includes('park')) return 'tag-nature';
    return 'tag-sea';
  };

  return (
    <div>
      <header>
        <h1>Family Adventures</h1>
        <p>Our upcoming plans and past memories</p>
      </header>

      <main className="container">
        {/* Upcoming Trips */}
        <section style={{ marginTop: '20px' }}>
          <h2 style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '8px', color: 'var(--primary-color)' }}>
            Upcoming Trips
          </h2>
          {upcomingTrips.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: '20px 0' }}>No upcoming trips planned yet.</p>
          ) : (
            <div className="grid">
              {upcomingTrips.map(trip => (
                <div key={trip.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary-color)' }}>{trip.name}</h3>
                    <span className={`tag ${getTagClass(trip.tag)}`}>{trip.tag}</span>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {trip.dates}
                  </span>
                  <p style={{ color: 'var(--text-color)', fontSize: '0.95rem', marginBottom: '20px', minHeight: '48px' }}>
                    {trip.description}
                  </p>
                  <Link href={`/trips/${trip.id}`} className="btn" style={{ width: '100%' }}>
                    View Itinerary
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Adventures */}
        <section style={{ marginTop: '50px', marginBottom: '40px' }}>
          <h2 style={{ borderBottom: '2px solid #95a5a6', paddingBottom: '8px', color: '#7f8c8d' }}>
            Past Adventures
          </h2>
          {pastTrips.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: '20px 0' }}>No past adventures recorded.</p>
          ) : (
            <div className="grid">
              {pastTrips.map(trip => (
                <div key={trip.id} className="card" style={{ opacity: 0.9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#555' }}>{trip.name}</h3>
                    <span className={`tag ${getTagClass(trip.tag)}`} style={{ filter: 'grayscale(30%)' }}>{trip.tag}</span>
                  </div>
                  <span style={{ fontSize: '0.9rem', color: '#7f8c8d', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    {trip.dates}
                  </span>
                  <p style={{ color: '#555', fontSize: '0.95rem', marginBottom: '20px', minHeight: '48px' }}>
                    {trip.description}
                  </p>
                  <Link href={`/trips/${trip.id}`} className="btn btn-secondary" style={{ width: '100%', backgroundColor: '#7f8c8d' }}>
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
