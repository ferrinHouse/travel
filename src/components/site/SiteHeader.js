import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import ThemeToggle from './ThemeToggle';
import UserMenu from './UserMenu';
import styles from './site.module.css';

/** Compact sticky bar on every page. */
export default async function SiteHeader() {
  const user = await getCurrentUser();
  return (
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
  );
}
