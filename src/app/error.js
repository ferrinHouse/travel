'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './status.module.css';

export default function Error({ error, unstable_retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.statusPage}>
      <span className={styles.statusIcon} aria-hidden="true">🧭</span>
      <h1 className={styles.statusTitle}>Something went wrong</h1>
      <p className={styles.statusText}>We hit a snag loading this page. It&apos;s usually temporary.</p>
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => unstable_retry()}>
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to Adventures
        </Link>
      </div>
    </main>
  );
}
