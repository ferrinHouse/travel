'use client';

import { useMemo, useState } from 'react';
import { buildDayTimeline } from '@/lib/itinerary';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useTrip } from '../TripContext';
import ActivityItem from './ActivityItem';
import ActivityForm from './ActivityForm';
import styles from '../trip.module.css';

export default function DayCard({ day }) {
  const { trip, dispatch, canEdit } = useTrip();
  const toast = useToast();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const timeline = useMemo(() => buildDayTimeline(day, trip.meals), [day, trip.meals]);

  const saveEdit = async (id, values) => {
    try {
      const data = await apiFetch('/api/activities', { method: 'POST', body: { id, ...values } });
      dispatch({ type: 'activity/replace', activity: data.activity });
      setEditingId(null);
    } catch (err) {
      toast.error(`Couldn't save activity: ${err.message}`);
    }
  };

  const add = async (values) => {
    try {
      const data = await apiFetch('/api/activities', { method: 'PUT', body: { dayId: day.id, ...values } });
      dispatch({ type: 'activity/add', dayId: day.id, activity: data.activity });
      setAdding(false);
    } catch (err) {
      toast.error(`Couldn't add activity: ${err.message}`);
    }
  };

  const remove = async (activity) => {
    const ok = await confirm({
      title: 'Delete activity?',
      message: `“${activity.description}” will be removed from ${day.dateLabel}.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch('/api/activities', { method: 'DELETE', body: { id: activity.id } });
      dispatch({ type: 'activity/remove', dayId: day.id, id: activity.id });
      toast.success('Activity deleted');
    } catch (err) {
      toast.error(`Couldn't delete activity: ${err.message}`);
    }
  };

  return (
    <section className={`itinerary-day card ${styles.dayCard}`} aria-label={day.dateLabel}>
      <div className="itinerary-day-header">
        <h2 className="itinerary-day-title">
          {day.dateLabel} {day.title ? `— ${day.title}` : ''}
        </h2>
      </div>

      <div className={styles.timeline}>
        {timeline.map((act) =>
          editingId === act.id && !act.isMeal ? (
            <div key={act.id} className={`activity-item ${styles.activityRow}`}>
              <ActivityForm
                idPrefix={`edit-${act.id}`}
                initial={act}
                submitLabel="Save"
                onSubmit={(values) => saveEdit(act.id, values)}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <ActivityItem
              key={act.id}
              activity={act}
              canEdit={canEdit}
              onEdit={() => setEditingId(act.id)}
              onDelete={() => remove(act)}
            />
          )
        )}

        {canEdit && (
          <div className={styles.addArea}>
            {adding ? (
              <div className={styles.addBox}>
                <h4>Add New Activity</h4>
                <ActivityForm
                  idPrefix={`new-${day.id}`}
                  submitLabel="Add"
                  onSubmit={add}
                  onCancel={() => setAdding(false)}
                />
              </div>
            ) : (
              <button type="button" className={`btn btn-outline ${styles.dashedButton}`} onClick={() => setAdding(true)}>
                + Add Activity
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
