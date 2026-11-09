'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-client';
import { canManagePhoto } from '@/lib/trip-permissions';
import { CAPTION_MAX } from '@/lib/photos/validate';
import { photoAlt, photoUrl } from '@/lib/photos/view';
import { useTrip } from '../TripContext';
import styles from './photos.module.css';

const SWIPE_PX = 50;
const takenFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', // camera wall time is stored as if it were UTC
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Full-screen photo viewer on a native <dialog>: arrow keys and swipes move
 * between photos; uploaders (and admins in Edit mode) can caption, move,
 * or delete; admins pick the trip's cover.
 */
export default function Lightbox({ items, openId, onOpen }) {
  const ref = useRef(null);
  const titleId = useId();
  const index = items.findIndex((i) => i.photo.id === openId);
  const open = index >= 0;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const go = (delta) => {
    if (items.length < 2) return;
    onOpen(items[(index + delta + items.length) % items.length].photo.id);
  };

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={ref}
      className={styles.viewer}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onOpen(null);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onOpen(null);
      }}
    >
      {open && (
        <ViewerBody
          key={items[index].photo.id}
          item={items[index]}
          position={index}
          total={items.length}
          titleId={titleId}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onClose={() => onOpen(null)}
          onDeleted={() => onOpen(items.length > 1 ? items[(index + 1) % items.length].photo.id : null)}
        />
      )}
    </dialog>
  );
}

function ViewerBody({ item, position, total, titleId, onPrev, onNext, onClose, onDeleted }) {
  const { photo, day, index } = item;
  const { trip, dispatch, userId, ...permissions } = useTrip();
  const toast = useToast();
  const confirm = useConfirm();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [dayNumber, setDayNumber] = useState(photo.dayNumber === null ? '' : String(photo.dayNumber));
  const swipeFrom = useRef(null);

  const canManage = canManagePhoto(permissions, userId, photo);
  const alt = photoAlt(photo, day, index);
  const taken = photo.takenAt ? takenFormat.format(new Date(`${photo.takenAt}Z`)) : null;

  async function patch(body, success) {
    setBusy(true);
    try {
      const data = await apiFetch('/api/photos', { method: 'PATCH', body: { id: photo.id, ...body } });
      dispatch({ type: 'photo/patch', id: photo.id, patch: data.photo });
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(`Couldn't save the photo: ${err.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const saved = await patch({ caption, dayNumber: dayNumber === '' ? null : Number(dayNumber) }, 'Photo updated');
    if (saved) setEditing(false);
  }

  async function remove() {
    const ok = await confirm({
      title: 'Delete this photo?',
      message: 'It will be removed from the trip for everyone.',
      confirmLabel: 'Delete photo',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch('/api/photos', { method: 'DELETE', body: { id: photo.id } });
      onDeleted();
      dispatch({ type: 'photo/remove', id: photo.id });
      toast.success('Photo deleted');
    } catch (err) {
      setBusy(false);
      toast.error(`Couldn't delete the photo: ${err.message}`);
    }
  }

  return (
    <div className={styles.viewerBody}>
      <div className={styles.viewerBar}>
        <h2 id={titleId} className={styles.viewerTitle}>
          Photo {position + 1} of {total}
        </h2>
        <button type="button" className="btn btn-ghost btn-md" onClick={onClose} aria-label="Close photo viewer">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <figure className={styles.viewerFigure}>
        <div
          className={styles.viewerStage}
          style={{ '--ratio': photo.height / photo.width }}
          onPointerDown={(e) => {
            swipeFrom.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeFrom.current === null) return;
            const dx = e.clientX - swipeFrom.current;
            swipeFrom.current = null;
            if (dx > SWIPE_PX) onPrev();
            else if (dx < -SWIPE_PX) onNext();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, cookie-protected files */}
          <img src={photoUrl(photo, 'lg')} alt={alt} width={photo.width} height={photo.height} draggable={false} />
          {total > 1 && (
            <>
              <button type="button" className={`${styles.navBtn} ${styles.navPrev}`} onClick={onPrev} aria-label="Previous photo">
                <span aria-hidden="true">‹</span>
              </button>
              <button type="button" className={`${styles.navBtn} ${styles.navNext}`} onClick={onNext} aria-label="Next photo">
                <span aria-hidden="true">›</span>
              </button>
            </>
          )}
        </div>
        <figcaption className={styles.viewerCaption}>
          {photo.caption && <p className={styles.captionText}>{photo.caption}</p>}
          <p className={styles.captionMeta}>
            {[day?.dateLabel ?? 'Not on a trip day', taken].filter(Boolean).join(' · ')}
            {photo.isCover && ' · Trip cover'}
          </p>
        </figcaption>
      </figure>

      {editing ? (
        <form className={styles.viewerForm} onSubmit={save}>
          <label className="form-label" htmlFor={`${formId}-caption`}>
            Caption
          </label>
          <input
            id={`${formId}-caption`}
            className="edit-input"
            value={caption}
            maxLength={CAPTION_MAX}
            onChange={(e) => setCaption(e.target.value)}
            autoFocus
          />
          <label className="form-label" htmlFor={`${formId}-day`}>
            Day
          </label>
          <select id={`${formId}-day`} className="edit-input" value={dayNumber} onChange={(e) => setDayNumber(e.target.value)}>
            <option value="">Not on a trip day</option>
            {trip.days.map((d) => (
              <option key={d.id} value={String(d.dayNumber)}>
                {d.dateLabel}
              </option>
            ))}
          </select>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={busy}>
              Save
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.viewerActions}>
          <a className="btn btn-outline btn-md" href={photoUrl(photo, 'orig', { download: true })} download>
            Download
          </a>
          {canManage && (
            <button type="button" className="btn btn-outline btn-md" onClick={() => setEditing(true)} disabled={busy}>
              Edit caption &amp; day
            </button>
          )}
          {permissions.canEdit && (
            <button
              type="button"
              className="btn btn-outline btn-md"
              onClick={() => patch({ isCover: !photo.isCover }, photo.isCover ? 'Cover photo removed' : 'Set as the trip cover')}
              disabled={busy}
              aria-pressed={photo.isCover}
            >
              {photo.isCover ? 'Trip cover ✓' : 'Make trip cover'}
            </button>
          )}
          {canManage && (
            <button type="button" className="btn btn-danger btn-md" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
