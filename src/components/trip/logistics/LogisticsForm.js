'use client';

import { useState } from 'react';
import styles from '../trip.module.css';

export default function LogisticsForm({ idPrefix, initial, submitLabel, rows, onSubmit, onCancel, onDelete }) {
  const [form, setForm] = useState({ title: initial?.title || '', content: initial?.content || '' });
  const [busy, setBusy] = useState(false);
  const valid = form.title.trim() && form.content.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await onSubmit(form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="form-label" htmlFor={`${idPrefix}-title`}>Title</label>
      <input
        id={`${idPrefix}-title`}
        type="text"
        className="edit-input"
        placeholder="e.g. Flight Details, Hotel Booking"
        required
        value={form.title}
        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
      />
      <label className="form-label" htmlFor={`${idPrefix}-content`}>Content (Markdown supported)</label>
      <textarea
        id={`${idPrefix}-content`}
        className="edit-input"
        rows={rows}
        placeholder="Enter booking confirmations, links, phone numbers, etc."
        required
        value={form.content}
        onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
      />
      <div className={styles.spaceBetween}>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={busy || !valid}>
            {busy ? 'Saving…' : submitLabel}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
        {onDelete && (
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
