import prisma from '@/lib/db';
import { requirePageUser } from '@/lib/auth/current-user';
import { emptyTripForm } from '@/lib/trips/form';
import TripForm from '@/components/trips/TripForm';
import styles from '@/components/trips/trips.module.css';

export const metadata = { title: 'Plan a new trip' };

export default async function NewTripPage() {
  await requirePageUser('/trips/new', 'edit');
  const trips = await prisma.trip.findMany({
    orderBy: { startDate: 'desc' },
    select: { id: true, name: true, tag: true, _count: { select: { checklist: true } } },
  });

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Plan a new trip</h1>
        <p className={styles.lede}>Start with the basics. Days, activities and meals are added on the trip page.</p>
      </header>
      <TripForm
        mode="create"
        initial={emptyTripForm()}
        tags={[...new Set(trips.map((t) => t.tag))]}
        copySources={trips.filter((t) => t._count.checklist > 0).map((t) => ({ id: t.id, name: t.name, count: t._count.checklist }))}
      />
    </main>
  );
}
