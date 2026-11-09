'use client';

import { useId } from 'react';

/** Label + input (+ optional hint) with the ids wired up. */
export default function Field({ label, hint, value, onChange, ...input }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="edit-input"
        aria-describedby={hint ? hintId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
    </>
  );
}
