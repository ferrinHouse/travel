import SavedTripsList from '@/components/offline/SavedTripsList';
import ReloadButton from '@/components/offline/ReloadButton';
import styles from '../status.module.css';

// Public (no sign-in) and holds nobody's data: the service worker saves it
// signed out and shows it when a page isn't available offline.
export const metadata = { title: 'Offline', robots: { index: false } };

export default function OfflinePage() {
  return (
    // data-offline-page: this page is also served at other addresses (whatever
    // page wasn't saved), so scripts recognise it by this, not the path.
    <main className={styles.statusPage} data-offline-page="">
      <span className={styles.statusIcon} aria-hidden="true">
        📡
      </span>
      <h1 className={styles.statusTitle}>You’re offline</h1>
      <p className={styles.statusText}>That page isn’t saved on this device. These trips are:</p>
      <SavedTripsList />
      <div className={styles.actions}>
        <ReloadButton />
      </div>
    </main>
  );
}
