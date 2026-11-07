'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import styles from './ui.module.css';

const ToastContext = createContext(null);

const DURATION = { info: 3500, success: 3000, error: 6000 };
const VARIANT_CLASS = { success: styles.toastSuccess, error: styles.toastError, info: '' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, variant = 'info') => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((list) => [...list.slice(-3), { id, message, variant }]);
      setTimeout(() => dismiss(id), DURATION[variant] ?? DURATION.info);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show,
      info: (message) => show(message, 'info'),
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toastRegion} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${VARIANT_CLASS[t.variant] || ''}`}>
            <span className={styles.toastMessage}>{t.message}</span>
            <button type="button" className={styles.toastClose} onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
