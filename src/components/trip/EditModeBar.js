'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-client';
import styles from './trip.module.css';

/** Shows view/edit status and the shared-passcode unlock dialog. */
export default function EditModeBar({ canEdit, onChange }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setPasscode('');
    setError('');
  };

  const unlock = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth', { method: 'POST', body: { passcode } });
      onChange(true);
      close();
      toast.success('Editing unlocked');
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect passcode. Try again.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    try {
      await apiFetch('/api/auth', { method: 'DELETE' });
      onChange(false);
    } catch (err) {
      toast.error(`Couldn't lock editing: ${err.message}`);
    }
  };

  return (
    <>
      <div className={styles.editBar}>
        <span className={`${styles.editStatus} ${canEdit ? styles.editStatusOn : ''}`}>
          {canEdit ? '🔓 ADMIN EDIT MODE ENABLED' : '🔒 VIEW ONLY MODE'}
        </span>
        {canEdit ? (
          <button type="button" className="btn btn-secondary btn-md" onClick={lock}>
            Lock Editing
          </button>
        ) : (
          <button type="button" className="btn btn-md" onClick={() => setOpen(true)}>
            Unlock Editing
          </button>
        )}
      </div>

      <Modal open={open} onClose={close} title="🔑 Enter Admin Passcode">
        <p className={styles.lockHint}>
          Enter the shared passcode to unlock editing and meal planning configurations.
        </p>
        <form onSubmit={unlock}>
          <input
            type="password"
            className="edit-input"
            placeholder="Passcode"
            aria-label="Passcode"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className={`form-actions ${styles.centerActions}`}>
            <button type="submit" className="btn" disabled={busy || !passcode}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
