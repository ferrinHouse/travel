import prisma from '@/lib/db';
import { requirePageUser } from '@/lib/auth/current-user';
import { listUsers } from '@/lib/api/users';
import { runHandler } from '@/lib/api/run';
import UsersAdmin from '@/components/admin/UsersAdmin';
import styles from '@/components/account/account.module.css';

export const metadata = { title: 'People' };

export default async function UsersPage() {
  const user = await requirePageUser('/admin/users', 'manage-users');
  const { body } = await runHandler(listUsers, { db: prisma, user });

  return (
    <main className={`container ${styles.page}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>People</h1>
        <p className={styles.meta}>Who can see our trips, and what they can change.</p>
      </header>
      <UsersAdmin initialUsers={body.users ?? []} currentUserId={user.id} />
    </main>
  );
}
