'use client';

import { checklistCategories } from '@/lib/categories';
import { useTrip } from '../TripContext';
import ChecklistCategory from './ChecklistCategory';

export default function ChecklistTab() {
  const { trip } = useTrip();
  const categories = checklistCategories(trip.checklist);

  return (
    <div className="grid">
      {categories.map((category) => (
        <ChecklistCategory
          key={category}
          category={category}
          items={trip.checklist.filter((item) => item.category === category)}
        />
      ))}
    </div>
  );
}
