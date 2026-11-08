// Shared test data: one small, fully populated trip.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC `offset` days from today. */
export function daysFromToday(offset) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offset * DAY_MS);
}

export async function seedTrip(prisma, overrides = {}) {
  const id = overrides.id ?? 'testville';
  const start = overrides.startDate ?? daysFromToday(30);
  const end = overrides.endDate ?? daysFromToday(31);

  await prisma.trip.create({
    data: {
      id,
      name: overrides.name ?? 'Testville Getaway',
      description: overrides.description ?? 'A trip used by automated tests.',
      dates: overrides.dates ?? 'Test dates',
      travelers: 'Family of 4',
      status: overrides.status ?? 'upcoming',
      startDate: start,
      endDate: end,
      tag: overrides.tag ?? 'City',
      primaryColor: '#004488',
      accentColor: '#d9534f',
      checklist: {
        create: [
          { text: 'Book hotel', category: 'pre-trip', isCompleted: true },
          { text: 'Sunscreen', category: 'packing' },
          { text: 'Transit app', category: 'app' },
        ],
      },
      logistics: {
        create: [
          { title: 'Flights', content: 'AA 123 **8:00 AM**', order: 0 },
          { title: 'Hotel', content: 'Conf #42 [map](https://maps.example.com)', order: 1 },
        ],
      },
      days: {
        create: [
          {
            dayNumber: 1,
            dateLabel: 'Day 1: Arrival',
            title: 'Getting there',
            activities: {
              create: [
                { time: '10:00 AM', description: 'Museum visit', order: 0 },
                { time: 'Evening', description: 'Night market', order: 1, isAlert: true, details: 'Bring cash' },
              ],
            },
          },
          { dayNumber: 2, dateLabel: 'Day 2: Exploring' },
        ],
      },
      meals: {
        create: [{ dayNumber: 1, mealType: 'Dinner', mealName: 'Pizza', details: 'Deep dish', time: '5:30 PM' }],
      },
      groceries: {
        create: [
          { name: 'Milk', category: 'Breakfast' },
          { name: 'Chips', category: 'Snacks', isBought: true },
        ],
      },
    },
  });

  return prisma.trip.findUnique({
    where: { id },
    include: {
      checklist: { orderBy: { id: 'asc' } },
      logistics: { orderBy: { order: 'asc' } },
      days: { orderBy: { dayNumber: 'asc' }, include: { activities: { orderBy: { order: 'asc' } } } },
      meals: true,
      groceries: { orderBy: { id: 'asc' } },
    },
  });
}
