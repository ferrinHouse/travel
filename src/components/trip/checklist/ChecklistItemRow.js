'use client';

import { useId, useState } from 'react';
import styles from '../trip.module.css';

export default function ChecklistItemRow({ item, canEdit, canToggle = true, onToggle, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const checkboxId = useId();

  const startEdit = () => {
    setText(item.text);
    setEditing(true);
  };

  const save = async () => {
    const value = text.trim();
    if (!value || value === item.text) {
      setEditing(false);
      return;
    }
    if (await onRename(value)) setEditing(false);
  };

  return (
    <div className={`checklist-item ${styles.checkRow}`}>
      <div className={styles.checkMain}>
        <input
          id={checkboxId}
          type="checkbox"
          className="checkbox-custom"
          checked={item.isCompleted}
          onChange={onToggle}
          disabled={!canToggle}
          aria-label={editing ? item.text : undefined}
        />
        {editing ? (
          <input
            type="text"
            className={`edit-input ${styles.inlineInput}`}
            aria-label="Item text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              else if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <label htmlFor={checkboxId} className={`${styles.checkLabel} ${item.isCompleted ? 'completed-text' : ''}`}>
            {item.text}
          </label>
        )}
      </div>
      {canEdit && (
        <div className={styles.rowActions}>
          {editing ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={save}>
                Save
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-icon" onClick={startEdit} aria-label={`Edit “${item.text}”`}>
                ✏️
              </button>
              <button type="button" className="btn-icon" onClick={onDelete} aria-label={`Delete “${item.text}”`}>
                ❌
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
