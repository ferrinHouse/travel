'use client';

import EmptyState from '@/components/ui/EmptyState';
import { useTrip } from '../TripContext';
import MealDay from './MealDay';
import GroceryList from './GroceryList';
import styles from '../trip.module.css';

export default function MealsTab() {
  const { trip } = useTrip();

  return (
    <div className={styles.mealsGrid}>
      <div className="card">
        <h2 className={styles.sectionHeading}>🥣 Day-by-Day Meal Planner</h2>
        {trip.days.length === 0 ? (
          <EmptyState icon="🥣" title="No days to plan meals for yet." />
        ) : (
          trip.days.map((day) => <MealDay key={day.id} day={day} />)
        )}
      </div>

      <GroceryList />
    </div>
  );
}
