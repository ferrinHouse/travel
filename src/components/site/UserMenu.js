'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import styles from './site.module.css';

/** Avatar button with a small menu: account, people (admins) and sign out. */
export default function UserMenu({ user }) {
  const ref = useRef(null);

  // Close when clicking elsewhere or pressing Escape.
  useEffect(() => {
    const close = (e) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (e.type === 'keydown' ? e.key === 'Escape' : !menu.contains(e.target)) {
        menu.open = false;
        if (e.type === 'keydown') menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  const signOut = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
    } finally {
      window.location.assign('/login');
    }
  };

  const initial = user.displayName.trim()[0]?.toUpperCase() ?? '?';

  return (
    <details ref={ref} className={styles.userMenu}>
      {/* The accessible name starts with the visible name (WCAG 2.5.3). */}
      <summary className={styles.userButton}>
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.userName}>{user.displayName}</span>
        <span className="visually-hidden"> (account menu)</span>
      </summary>
      <div className={styles.menu}>
        <Link href="/account" className={styles.menuItem}>
          Your account
        </Link>
        {user.role === 'admin' && (
          <Link href="/admin/users" className={styles.menuItem}>
            People
          </Link>
        )}
        <button type="button" className={styles.menuItem} onClick={signOut}>
          Sign out
        </button>
      </div>
    </details>
  );
}
