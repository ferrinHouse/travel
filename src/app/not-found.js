import Link from 'next/link';
import styles from './status.module.css';

export default function NotFound() {
  return (
    <main className={styles.statusPage}>
      <span className={styles.statusIcon} aria-hidden="true">🗺️</span>
      <h1 className={styles.statusTitle}>Page not found</h1>
      <p className={styles.statusText}>That page isn&apos;t on the map.</p>
      <div className={styles.actions}>
        <Link href="/" className="btn">
          Back to Adventures
        </Link>
      </div>
    </main>
  );
}
