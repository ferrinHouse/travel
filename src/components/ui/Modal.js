'use client';

import { useEffect, useId, useRef } from 'react';
import styles from './ui.module.css';

/**
 * Accessible modal built on the native <dialog> element: showModal() gives
 * focus trapping, Escape-to-close and an inert background for free.
 * Children only mount while open so form state resets between openings.
 */
export default function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={title ? titleId : undefined}
      onCancel={(e) => {
        // Escape key: let React state drive closing.
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        // A click directly on the <dialog> (not its body) is a backdrop click.
        if (e.target === ref.current) onClose?.();
      }}
    >
      {open && (
        <div className={styles.dialogBody}>
          {title && (
            <h3 id={titleId} className={styles.dialogTitle}>
              {title}
            </h3>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
