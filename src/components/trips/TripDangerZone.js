'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import styles from './trips.module.css';

/** Archive / restore, and delete (typing the trip name to confirm). */
export default function TripDangerZone({ trip }) {
  const router = useRouter();
  const toast = useToast();
  const confirmId = useId();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const archived = !!trip.archivedAt;

  async function toggleArchive() {
    setBusy(true);
    try {
      await apiFetch('/api/trips/archive', { method: 'POST', body: { id: trip.id, archived: !archived } });
      toast.success(archived ? `${trip.name} is back on the home page` : `${trip.name} is archived`);
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't ${archived ? 'restore' : 'archive'} the trip: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/trips', { method: 'DELETE', body: { id: trip.id, confirmName: typed } });
      toast.success(`${trip.name} was deleted`);
      router.push('/');
      router.refresh();
    } catch (err) {
      setBusy(false);
      toast.error(`Couldn't delete the trip: ${err.message}`);
    }
  }

  const matches = typed.trim() === trip.name;

  return (
    <section className={`card ${styles.danger}`} aria-labelledby={`${confirmId}-title`}>
      <h2 id={`${confirmId}-title`} className={styles.legend}>
        Archive or delete
      </h2>

      <div className={styles.dangerRow}>
        <div>
          <h3 className={styles.dangerTitle}>{archived ? 'This trip is archived' : 'Archive this trip'}</h3>
          <p className={styles.dangerText}>
            {archived
              ? 'It’s tucked away under “Archived” on the home page. Restore it to show it with the other trips again.'
              : 'Hide it from the home page’s main lists. Nothing is deleted, and you can restore it any time.'}
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={toggleArchive} disabled={busy}>
          {archived ? 'Restore trip' : 'Archive trip'}
        </button>
      </div>

      <div className={styles.dangerRow}>
        <div>
          <h3 className={styles.dangerTitle}>Delete this trip</h3>
          <p className={styles.dangerText}>Removes the itinerary, checklists, meals and logistics for good.</p>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => { setTyped(''); setDeleting(true); }} disabled={busy}>
          Delete trip…
        </button>
      </div>

      <Modal open={deleting} onClose={() => setDeleting(false)} title={`Delete ${trip.name}?`}>
        <form onSubmit={remove}>
          <p>
            This can&apos;t be undone. Everything in this trip is deleted for everyone. Type the trip name to confirm.
          </p>
          <label className="form-label" htmlFor={confirmId}>
            Trip name
          </label>
          <input
            id={confirmId}
            className="edit-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={trip.name}
            autoComplete="off"
            autoFocus
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-danger" disabled={!matches || busy}>
              Delete forever
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(false)}>
              Keep it
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
