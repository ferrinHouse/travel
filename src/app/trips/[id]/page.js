import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/db';
import TripDetailsClient from '@/components/TripDetailsClient';

export const revalidate = 0; // Disable cache for live updates

async function getTripDetails(id) {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        checklist: {
          orderBy: { id: 'asc' }
        },
        logistics: {
          orderBy: { order: 'asc' }
        },
        days: {
          orderBy: { dayNumber: 'asc' },
          include: {
            activities: {
              orderBy: { order: 'asc' }
            }
          }
        },
        meals: true,
        groceries: {
          orderBy: { id: 'asc' }
        }
      }
    });
    return trip;
  } catch (error) {
    console.error('Error fetching trip details:', error);
    return null;
  }
}

export default async function TripDetailsPage({ params }) {
  const { id } = await params;
  const trip = await getTripDetails(id);

  if (!trip) {
    notFound();
  }

  return (
    <div>
      <header style={{ 
        background: `linear-gradient(135deg, ${trip.primaryColor || 'var(--primary-color)'} 0%, #1a252f 100%)` 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <Link href="/" style={{ color: 'white', fontSize: '1rem', fontWeight: 'bold' }}>
            ← Back to Adventures
          </Link>
          <div style={{ flexGrow: 1, textAlign: 'center' }}>
            <h1 style={{ margin: 0 }}>{trip.name}</h1>
            <p style={{ margin: '5px 0 0 0' }}>{trip.dates} &bull; {trip.travelers}</p>
          </div>
          <div style={{ width: '130px' }} /> {/* Spacer */}
        </div>
      </header>

      <main className="container">
        <TripDetailsClient initialTrip={trip} />
      </main>
    </div>
  );
}
