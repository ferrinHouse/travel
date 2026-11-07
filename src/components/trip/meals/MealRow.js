'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MEAL_PLACEHOLDERS, buildMealPayload, isEmptyMeal, mealChanged } from '@/lib/meals';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { useTrip } from '../TripContext';
import styles from '../trip.module.css';

const DEBOUNCE_MS = 600;
const STATUS_ICON = { saving: '…', saved: '✓', error: '!' };

/**
 * Editable meal slot. Edits go to a local draft and are saved after a short
 * pause or on blur, always from the latest draft. Saves are serialised so two
 * quick saves can't race and create duplicate meal records. Clearing the name
 * only deletes the meal on blur, so retyping a name doesn't drop its details.
 */
export default function MealRow({ dayNumber, mealType, saved }) {
  const { trip, dispatch } = useTrip();
  const toast = useToast();
  const id = useId();

  const [draft, setDraft] = useState({ mealName: saved?.mealName || '', time: saved?.time || '' });
  const [status, setStatus] = useState('idle');

  const latestDraft = useRef(draft);
  const savedRef = useRef(saved);
  const queue = useRef(Promise.resolve());
  const timer = useRef({ id: null });

  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const save = useCallback(() => {
    clearTimeout(timer.current.id);
    timer.current.id = null;

    queue.current = queue.current.then(async () => {
      const current = latestDraft.current;
      if (!mealChanged(savedRef.current, current)) return;
      setStatus('saving');
      try {
        const data = await apiFetch('/api/meals', {
          method: 'POST',
          body: buildMealPayload(trip.id, dayNumber, mealType, current),
        });
        if (data.deleted) {
          savedRef.current = null;
          dispatch({ type: 'meal/remove', dayNumber, mealType });
        } else {
          savedRef.current = data.meal;
          dispatch({ type: 'meal/upsert', meal: data.meal });
        }
        setStatus('saved');
      } catch (err) {
        setStatus('error');
        toast.error(`Couldn't save ${mealType.toLowerCase()}: ${err.message}`);
      }
    });
    return queue.current;
  }, [trip.id, dayNumber, mealType, dispatch, toast]);

  // Flush a pending debounced save if the row unmounts (e.g. switching tabs).
  useEffect(() => {
    const pending = timer.current;
    return () => {
      if (pending.id) save();
    };
  }, [save]);

  const onChange = (e) => {
    const next = { ...latestDraft.current, [e.target.name]: e.target.value };
    latestDraft.current = next;
    setDraft(next);
    setStatus('idle');
    clearTimeout(timer.current.id);
    timer.current.id = isEmptyMeal(next) ? null : setTimeout(save, DEBOUNCE_MS);
  };

  const placeholder = MEAL_PLACEHOLDERS[mealType];

  return (
    <>
      <label className={styles.mealType} htmlFor={`${id}-name`}>
        {mealType}:
      </label>
      <div className={styles.mealInputs}>
        <input
          id={`${id}-name`}
          type="text"
          className={`edit-input ${styles.mealNameInput}`}
          name="mealName"
          value={draft.mealName}
          onChange={onChange}
          onBlur={save}
          placeholder={placeholder.name}
        />
        <input
          type="text"
          className={`edit-input ${styles.mealTimeInput}`}
          aria-label={`${mealType} time`}
          name="time"
          value={draft.time}
          onChange={onChange}
          onBlur={save}
          placeholder={placeholder.time}
        />
        <span
          className={`${styles.saveState} ${status === 'error' ? styles.saveError : ''}`}
          role="status"
          aria-label={status === 'idle' ? undefined : status}
        >
          {STATUS_ICON[status] || ''}
        </span>
      </div>
    </>
  );
}
