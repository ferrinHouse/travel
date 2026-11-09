import prisma from '@/lib/db';
import { requirePageUser } from '@/lib/auth/current-user';
import { listMyPasskeys, listMySessions } from '@/lib/api/account';
import { runHandler } from '@/lib/api/run';
import PasswordCard from '@/components/account/PasswordCard';
import PasskeysCard from '@/components/account/PasskeysCard';
import SessionsCard from '@/components/account/SessionsCard';
import styles from '@/components/account/account.module.css';

export const metadata = { title: 'Your account' };

const ROLE_LABEL = {
  admin: 'Admin: can plan trips and manage people',
  member: 'Member: can tick things off and add items',
  viewer: 'Viewer: can see everything',
};

export default async function AccountPage({ searchParams }) {
  const user = await requirePageUser('/account');
  const { welcome } = await searchParams;
  const ctx = { db: prisma, user };
  const [{ body: passkeys }, { body: sessions }] = await Promise.all([
    runHandler(listMyPasskeys, ctx),
    runHandler(listMySessions, ctx),
  ]);

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>{user.displayName}</h1>
        <p className={styles.meta}>
          @{user.username} · {ROLE_LABEL[user.role] ?? user.role}
        </p>
      </header>
      <div className={styles.sections}>
        {welcome && passkeys.passkeys.length === 0 && (
          <p className={`card ${styles.welcome}`} role="status">
            You&apos;re all set up. Add a passkey below so signing in on this device is one tap.
          </p>
        )}
        <PasskeysCard initialPasskeys={passkeys.passkeys ?? []} />
        <PasswordCard username={user.username} hasPassword={user.hasPassword} />
        <SessionsCard initialSessions={sessions.sessions ?? []} />
      </div>
    </main>
  );
}
