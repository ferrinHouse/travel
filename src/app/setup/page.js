import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { appConfig } from '@/lib/api/request-context';
import SetupForm from '@/components/auth/SetupForm';
import styles from '@/components/auth/auth.module.css';

export const metadata = { title: 'Set up' };

// Only exists until the first admin is created, and only with SETUP_TOKEN set.
export default async function SetupPage() {
  if (await getCurrentUser()) redirect('/');
  if (!appConfig(process.env).setupToken || (await prisma.user.count()) > 0) notFound();

  return (
    <main className={styles.page}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>Set up Family Adventures</h1>
        <p className={styles.lede}>Create the first admin account. You can invite everyone else afterwards.</p>
        <SetupForm />
      </div>
    </main>
  );
}
