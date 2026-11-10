import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { userKeyFor } from '@/lib/offline/state';
import ConnectionStatus from '@/components/offline/ConnectionStatus';
import OfflineManager from '@/components/offline/OfflineManager';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import styles from './site.module.css';

/** Compact sticky bar on every page, plus offline support and the connection strip. */
export default async function SiteHeader() {
  const user = await getCurrentUser();
  // When this page is shown later from the offline copy, its age tells the
  // browser it's a saved copy. A server component renders once per request,
  // so reading the clock here is the point.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-brand">
            <span aria-hidden="true">🧭</span>
            <span className="site-brand-text">Family Adventures</span>
          </Link>
          <div className={styles.headerActions}>
            <ThemeToggle />
            {user && <UserMenu user={{ displayName: user.displayName, role: user.role }} />}
          </div>
        </div>
      </header>
      <OfflineManager userKey={userKeyFor(user)} renderedAt={renderedAt} />
      <ConnectionStatus renderedAt={renderedAt} />
    </>
  );
}
