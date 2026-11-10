'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { flushOutbox, onDropped } from './outbox';
import { useOnOfflinePage, useOnline, useOutbox, useSavedCopy } from './useOffline';
import styles from './offline.module.css';

const savedAtFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const changes = (n) => `${n} ${n === 1 ? 'change' : 'changes'}`;

/**
 * A strip under the header when something about the connection matters:
 * offline, looking at a saved copy, or ticks still waiting to sync.
 */
export default function ConnectionStatus({ renderedAt }) {
  const toast = useToast();
  const online = useOnline();
  const savedCopy = useSavedCopy(renderedAt);
  const outbox = useOutbox();
  const offlinePage = useOnOfflinePage();

  useEffect(
    () =>
      onDropped((op, result) => {
        toast.error(`Couldn’t save the change to “${op.label}”: ${result.message} Reload the page to see the latest.`);
      }),
    [toast]
  );

  const { pending, syncing, needsAuth } = outbox;
  const savedAt = savedCopy ? savedAtFormat.format(new Date(renderedAt)) : null;
  let message = null;
  let action = null;

  if (offlinePage) {
    // The page itself explains being offline.
  } else if (!online) {
    message = [
      'You’re offline.',
      savedAt && `This is the copy saved ${savedAt}.`,
      pending
        ? `${changes(pending)} will sync when you’re back online.`
        : 'Packing and grocery ticks you make are kept on this device until you’re back online.',
    ]
      .filter(Boolean)
      .join(' ');
  } else if (pending && needsAuth) {
    message = `Sign in again to sync ${changes(pending)} made on this device.`;
    action = (
      <a className="btn btn-sm" href={`/login?next=${encodeURIComponent(window.location.pathname)}`}>
        Sign in
      </a>
    );
  } else if (pending) {
    message = syncing ? `Syncing ${changes(pending)}…` : `${changes(pending)} waiting to sync.`;
    if (!syncing) {
      action = (
        <button type="button" className="btn btn-sm btn-outline" onClick={() => flushOutbox()}>
          Sync now
        </button>
      );
    }
  } else if (savedAt) {
    message = `The connection is slow, so this is the copy saved ${savedAt}.`;
    action = (
      <button type="button" className="btn btn-sm btn-outline" onClick={() => window.location.reload()}>
        Reload
      </button>
    );
  }

  return (
    <div className={styles.statusRegion} role="status">
      {message && (
        <div className={styles.status} data-offline={!online || undefined}>
          <p className={styles.statusText}>
            <span aria-hidden="true">{online ? '🔄' : '📡'}</span> {message}
          </p>
          {action}
        </div>
      )}
    </div>
  );
}
