'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { describeDevice } from '@/lib/device-name';
import { useToast } from '@/components/ui/Toast';
import When from './When';
import styles from './account.module.css';

export default function SessionsCard({ initialSessions }) {
  const toast = useToast();
  const [sessions, setSessions] = useState(initialSessions);

  const revoke = async (session) => {
    try {
      await apiFetch('/api/account/sessions', { method: 'DELETE', body: { id: session.id } });
      setSessions((list) => list.filter((s) => s.id !== session.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const signOut = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <section className="card" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className={styles.sectionTitle}>
        Signed-in devices
      </h2>
      <p className={styles.sectionLede}>Sign out anywhere you don&apos;t recognise, or a device you no longer have.</p>
      <ul className={styles.list}>
        {sessions.map((s) => (
          <li key={s.id} className={styles.row}>
            <div className={styles.rowMain}>
              <p className={styles.rowTitle}>
                {describeDevice(s.userAgent)}
                {s.current && <span className={styles.badge}>This device</span>}
              </p>
              <p className={styles.rowMeta}>
                Signed in <When value={s.createdAt} /> · Last active <When value={s.lastSeenAt} />
              </p>
            </div>
            {!s.current && (
              <div className={styles.rowActions}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => revoke(s)}>
                  Sign out
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-secondary btn-md" onClick={signOut}>
        Sign out of this device
      </button>
    </section>
  );
}
