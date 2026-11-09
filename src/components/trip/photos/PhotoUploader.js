'use client';

import { useId, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { runQueue, uploadUrl } from '@/lib/photos/upload';
import { useTrip } from '../TripContext';
import { preparePhoto } from './preparePhoto';
import styles from './photos.module.css';

let nextKey = 0;

async function send(tripId, file) {
  const { blob, takenAt } = await preparePhoto(file);
  let res;
  try {
    res = await fetch(uploadUrl(tripId, { takenAt }), {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
  } catch {
    throw new Error('Network error — check your connection.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || (res.status === 413 ? 'That photo is too big.' : `Upload failed (${res.status}).`));
  }
  return data.photo;
}

/** "Add photos" button, progress bar, and a retry list for any that failed. Two uploads at a time. */
export default function PhotoUploader() {
  const { trip, dispatch } = useTrip();
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef(null);
  const [items, setItems] = useState([]); // { key, file, status: waiting|uploading|done|failed, error }

  const update = (key, patch) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function upload(batch) {
    let ok = 0;
    await runQueue(batch, 2, async (item) => {
      update(item.key, { status: 'uploading', error: null });
      try {
        const photo = await send(trip.id, item.file);
        dispatch({ type: 'photo/add', photo });
        update(item.key, { status: 'done' });
        ok++;
      } catch (err) {
        update(item.key, { status: 'failed', error: err.message });
      }
    });
    const failed = batch.length - ok;
    if (failed === 0) toast.success(ok === 1 ? 'Photo added' : `${ok} photos added`);
    else toast.error(`${failed} of ${batch.length} photo${batch.length === 1 ? '' : 's'} didn’t upload`);
  }

  function choose(e) {
    const files = [...(e.target.files ?? [])];
    e.target.value = ''; // picking the same files again still fires change
    if (!files.length) return;
    const batch = files.map((file) => ({ key: ++nextKey, file, status: 'waiting', error: null }));
    setItems((list) => [...list.filter((i) => i.status !== 'done' && i.status !== 'failed'), ...batch]);
    upload(batch);
  }

  function retry() {
    const failed = items.filter((i) => i.status === 'failed').map((i) => ({ ...i, status: 'waiting', error: null }));
    setItems((list) => list.map((i) => (i.status === 'failed' ? { ...i, status: 'waiting', error: null } : i)));
    upload(failed);
  }

  const active = items.filter((i) => i.status === 'waiting' || i.status === 'uploading');
  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'failed');
  const busy = active.length > 0;

  return (
    <div className={styles.uploader}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className={styles.fileInput}
        onChange={choose}
        aria-label="Choose photos to add"
        tabIndex={-1}
      />
      <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
        <span aria-hidden="true">＋</span> Add photos
      </button>

      <div aria-live="polite" className={styles.uploadStatus}>
        {busy && (
          <>
            <label htmlFor={`${inputId}-progress`}>
              Uploading photos: {done} of {done + active.length} done
            </label>
            <progress id={`${inputId}-progress`} value={done} max={done + active.length} />
          </>
        )}
      </div>

      {failed.length > 0 && !busy && (
        <div className={styles.uploadFailed} role="alert">
          <p>
            {failed.length === 1 ? 'One photo didn’t upload:' : `${failed.length} photos didn’t upload:`}
          </p>
          <ul>
            {failed.map((i) => (
              <li key={i.key}>
                <strong>{i.file.name}</strong> — {i.error}
              </li>
            ))}
          </ul>
          <div className={styles.uploadFailedActions}>
            <button type="button" className="btn btn-outline" onClick={retry}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setItems((list) => list.filter((i) => i.status !== 'failed'))}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
