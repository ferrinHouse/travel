import Link from 'next/link';
import styles from '../../status.module.css';

export default function TripNotFound() {
  return (
    <main className={styles.statusPage}>
      <span className={styles.statusIcon} aria-hidden="true">🧳</span>
      <h1 className={styles.statusTitle}>Trip not found</h1>
      <p className={styles.statusText}>We couldn&apos;t find that adventure. It may have been renamed or removed.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn">
          Back to Adventures
        </Link>
      </div>
    </main>
  );
}
