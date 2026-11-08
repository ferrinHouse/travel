'use client';

import { MEAL_TYPES, findMeal } from '@/lib/meals';
import { useTrip } from '../TripContext';
import MealRow from './MealRow';
import styles from '../trip.module.css';

export default function MealDay({ day }) {
  const { trip, canEdit } = useTrip();

  return (
    <div className={styles.mealDay}>
      <h4 className={styles.mealDayLabel}>{day.dateLabel}</h4>
      <div className={styles.mealGrid}>
        {MEAL_TYPES.map((mealType) => {
          const saved = findMeal(trip.meals, day.dayNumber, mealType);
          return canEdit ? (
            <MealRow key={mealType} dayNumber={day.dayNumber} mealType={mealType} saved={saved} />
          ) : (
            <MealDisplay key={mealType} mealType={mealType} meal={saved} />
          );
        })}
      </div>
    </div>
  );
}

function MealDisplay({ mealType, meal }) {
  return (
    <>
      <span className={styles.mealType}>{mealType}:</span>
      <span>
        {meal?.mealName ? (
          <>
            {meal.mealName} {meal.time && <span className={styles.mealTime}>({meal.time})</span>}
          </>
        ) : (
          <span className={styles.notPlanned}>Not planned</span>
        )}
      </span>
    </>
  );
}
