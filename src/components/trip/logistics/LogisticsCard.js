'use client';

import { useState } from 'react';
import Markdown from '@/components/ui/Markdown';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { apiFetch } from '@/lib/api-client';
import { useTrip } from '../TripContext';
import LogisticsForm from './LogisticsForm';
import styles from '../trip.module.css';

export default function LogisticsCard({ card }) {
  const { dispatch, canEdit } = useTrip();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const save = async (values) => {
    try {
      const data = await apiFetch('/api/logistics', { method: 'POST', body: { id: card.id, ...values } });
      dispatch({ type: 'logistics/replace', card: data.card });
      setEditing(false);
    } catch (err) {
      toast.error(`Couldn't save card: ${err.message}`);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete logistics card?',
      message: `“${card.title}” and its notes will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch('/api/logistics', { method: 'DELETE', body: { id: card.id } });
      dispatch({ type: 'logistics/remove', id: card.id });
      toast.success('Card deleted');
    } catch (err) {
      toast.error(`Couldn't delete card: ${err.message}`);
    }
  };

  return (
    <div className="card">
      {editing ? (
        <LogisticsForm
          idPrefix={`logistics-${card.id}`}
          initial={card}
          submitLabel="Save"
          rows={10}
          onSubmit={save}
          onCancel={() => setEditing(false)}
          onDelete={remove}
        />
      ) : (
        <>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            {canEdit && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
          <Markdown as="div" text={card.content} className={styles.logisticsContent} />
        </>
      )}
    </div>
  );
}
