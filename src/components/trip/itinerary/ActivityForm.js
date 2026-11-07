'use client';

import { useState } from 'react';
import styles from '../trip.module.css';

const EMPTY = { time: '', description: '', details: '', isAlert: false };

/** Shared add/edit form for itinerary activities. */
export default function ActivityForm({ idPrefix, initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          time: initial.time || '',
          description: initial.description || '',
          details: initial.details || '',
          isAlert: !!initial.isAlert,
        }
      : EMPTY
  );
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.fullWidth} onSubmit={submit}>
      <label className="form-label" htmlFor={`${idPrefix}-time`}>Time</label>
      <input
        id={`${idPrefix}-time`}
        type="text"
        className="edit-input"
        placeholder="e.g. 10:00 AM, Morning"
        value={form.time}
        onChange={set('time')}
      />
      <label className="form-label" htmlFor={`${idPrefix}-desc`}>Description</label>
      <input
        id={`${idPrefix}-desc`}
        type="text"
        className="edit-input"
        required
        value={form.description}
        onChange={set('description')}
      />
      <label className="form-label" htmlFor={`${idPrefix}-details`}>Details / Note</label>
      <textarea
        id={`${idPrefix}-details`}
        className="edit-input"
        rows={3}
        placeholder="Notes / Links / Details (markdown supported)"
        value={form.details}
        onChange={set('details')}
      />
      <div className={styles.checkboxRow}>
        <input id={`${idPrefix}-alert`} type="checkbox" checked={form.isAlert} onChange={set('isAlert')} />
        <label htmlFor={`${idPrefix}-alert`}>
          <strong>Highlight this event</strong> (red alert box)
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy || !form.description.trim()}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
