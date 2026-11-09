'use client';

import Link from 'next/link';
import styles from './trip.module.css';

/**
 * Admins switch "Edit mode" on to change the plan (off by default so a stray
 * tap can't delete anything) and reach the trip's settings (name, dates,
 * colours, archive). Viewers get a note explaining why boxes are locked.
 */
export default function EditModeBar({ isAdmin, canToggle, tripId, editMode, onChange }) {
  if (isAdmin) {
    return (
      <div className={styles.editBar}>
        <span className={`${styles.editStatus} ${editMode ? styles.editStatusOn : ''}`} aria-live="polite">
          {editMode ? '✏️ Editing the plan' : 'Viewing the plan'}
        </span>
        <Link href={`/trips/${tripId}/edit`} className="btn btn-md btn-ghost">
          Trip settings
        </Link>
        <button
          type="button"
          className={`btn btn-md ${editMode ? '' : 'btn-secondary'}`}
          aria-pressed={editMode}
          onClick={() => onChange(!editMode)}
        >
          {editMode ? 'Done editing' : 'Edit mode'}
        </button>
      </div>
    );
  }
  if (!canToggle) {
    return (
      <div className={styles.editBar}>
        <span className={styles.editStatus}>👀 View only. Ask an admin if you need to tick things off.</span>
      </div>
    );
  }
  return null;
}
