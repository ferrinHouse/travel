'use client';

import { useId, useState } from 'react';
import { checklistLabel } from '@/lib/categories';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { saveTick } from '@/components/offline/outbox';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useTrip } from '../TripContext';
import ChecklistItemRow from './ChecklistItemRow';
import styles from '../trip.module.css';

export default function ChecklistCategory({ category, items }) {
  const { trip, dispatch, canEdit, canAdd, canToggle } = useTrip();
  const toast = useToast();
  const confirm = useConfirm();
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const inputId = useId();

  // Members and admins tick items; roll back if the save fails.
  const toggle = async (item) => {
    const next = !item.isCompleted;
    dispatch({ type: 'checklist/patch', id: item.id, patch: { isCompleted: next } });
    try {
      // Kept on the device and sent later when there's no connection.
      await saveTick({ kind: 'checklist', id: item.id, tripId: trip.id, value: next, label: item.text });
    } catch (err) {
      dispatch({ type: 'checklist/patch', id: item.id, patch: { isCompleted: !next } });
      toast.error(`Couldn't update “${item.text}”: ${err.message}`);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      const data = await apiFetch('/api/checklist', {
        method: 'POST',
        body: { tripId: trip.id, text, category },
      });
      dispatch({ type: 'checklist/add', item: data.item });
      setNewText('');
    } catch (err) {
      toast.error(`Couldn't add item: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const rename = async (item, text) => {
    try {
      const data = await apiFetch('/api/checklist', { method: 'POST', body: { id: item.id, text } });
      dispatch({ type: 'checklist/patch', id: item.id, patch: { text: data.item.text } });
      return true;
    } catch (err) {
      toast.error(`Couldn't rename item: ${err.message}`);
      return false;
    }
  };

  const remove = async (item) => {
    const ok = await confirm({
      title: 'Delete item?',
      message: `“${item.text}” will be removed from the list.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch('/api/checklist', { method: 'DELETE', body: { id: item.id } });
      dispatch({ type: 'checklist/remove', id: item.id });
    } catch (err) {
      toast.error(`Couldn't delete item: ${err.message}`);
    }
  };

  return (
    <div className="card">
      <h3 className={styles.listHeading}>{checklistLabel(category)}</h3>

      <div>
        {items.length === 0 ? (
          <p className={styles.emptyNote}>No items in this list.</p>
        ) : (
          items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              canToggle={canToggle}
              onToggle={() => toggle(item)}
              onRename={(text) => rename(item, text)}
              onDelete={() => remove(item)}
            />
          ))
        )}
      </div>

      {canAdd && (
        <form className={styles.addRow} onSubmit={add}>
          <label htmlFor={inputId} className="visually-hidden">
            Add item to {checklistLabel(category)}
          </label>
          <input
            id={inputId}
            type="text"
            placeholder="Add new item..."
            className={`edit-input ${styles.addInput}`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button type="submit" className="btn btn-md" disabled={adding || !newText.trim()}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}
