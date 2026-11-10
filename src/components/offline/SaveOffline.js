'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import { offlineSupported, saveTripOffline } from './worker';
import { useSavedTrips } from './useOffline';
import styles from './offline.module.css';

const savedFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "Save for offline" on a trip page: keeps the trip, its story and photos on this device. */
export default function SaveOffline({ trip, photos }) {
  const toast = useToast();
  const supported = useBrowserFlag(offlineSupported);
  const entry = useSavedTrips()[trip.id];
  const [busy, setBusy] = useState(false);

  if (!supported) return null;

  const save = async () => {
    setBusy(true);
    try {
      const result = await saveTripOffline(trip, photos);
      const missed = result.failed.length;
      toast.success(missed ? `Saved for offline (${missed} ${missed === 1 ? 'item' : 'items'} couldn’t be saved)` : 'Saved for offline');
    } catch (err) {
      toast.error(`Couldn’t save for offline: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.save}>
      <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy}>
        <span aria-hidden="true">📥</span> {busy ? 'Saving…' : entry ? 'Update offline copy' : 'Save for offline'}
      </button>
      {entry && <span>Available offline · saved {savedFormat.format(new Date(entry.savedAt))}</span>}
    </div>
  );
}
