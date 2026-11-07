'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal';
import styles from './ui.module.css';

const ConfirmContext = createContext(null);

/**
 * Provides `useConfirm()`: `await confirm({ title, message, confirmLabel, danger })`
 * resolves to true/false. Replaces window.confirm with an accessible dialog.
 */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setRequest({ ...options, resolve });
      }),
    []
  );

  const finish = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!request} onClose={() => finish(false)} title={request?.title || 'Are you sure?'}>
        {request?.message && <p className={styles.dialogMessage}>{request.message}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className="btn btn-secondary" onClick={() => finish(false)}>
            {request?.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${request?.danger ? 'btn-danger' : ''}`}
            onClick={() => finish(true)}
          >
            {request?.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
