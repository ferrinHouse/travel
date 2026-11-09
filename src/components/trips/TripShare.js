'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import styles from './trips.module.css';

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/**
 * Optional read-only link to the trip story for people without an account.
 * Off by default. Only the link's hash is stored, so the address shows once,
 * right after it's made; "Make a new link" retires the old one.
 */
export default function TripShare({ tripId, sharedSince }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const on = !!url || !!sharedSince;

  async function create() {
    setBusy(true);
    try {
      const data = await apiFetch('/api/trips/share', { method: 'POST', body: { tripId } });
      setUrl(data.url);
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't make a share link: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await apiFetch('/api/trips/share', { method: 'DELETE', body: { tripId } });
      setUrl(null);
      toast.success('Share link turned off');
      router.refresh();
    } catch (err) {
      toast.error(`Couldn't turn the link off: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy. Select the link and copy it instead.');
    }
  }

  return (
    <section className={`card ${styles.danger} ${styles.share}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.legend}>
        Share the story
      </h2>
      <div className={styles.dangerRow}>
        <div>
          <h3 className={styles.dangerTitle}>{on ? 'Sharing is on' : 'Sharing is off'}</h3>
          <p className={styles.dangerText}>
            {on
              ? `Anyone with the link can see the trip story and photos (not logistics, checklists or meals).${
                  sharedSince && !url ? ` Link made ${dateFormat.format(new Date(sharedSince))}.` : ''
                }`
              : 'Make a link to show the trip story and photos to grandparents and friends without an account.'}
          </p>
        </div>
        <div className={styles.shareButtons}>
          <button type="button" className="btn btn-outline" onClick={create} disabled={busy}>
            {on ? 'Make a new link' : 'Make a share link'}
          </button>
          {on && (
            <button type="button" className="btn btn-ghost" onClick={turnOff} disabled={busy}>
              Turn off
            </button>
          )}
        </div>
      </div>
      {url && (
        <div>
          <label className="form-label" htmlFor={`${id}-url`}>
            Share link (copy it now: it won’t be shown again)
          </label>
          <div className={styles.shareUrl}>
            <input id={`${id}-url`} className="edit-input" value={url} readOnly onFocus={(e) => e.target.select()} />
            <button type="button" className="btn" onClick={copy}>
              Copy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
