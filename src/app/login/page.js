import Link from 'next/link';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { safeNextPath } from '@/lib/auth/safe-redirect';
import { appConfig } from '@/lib/api/request-context';
import LoginForm from '@/components/auth/LoginForm';
import styles from '@/components/auth/auth.module.css';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  const destination = safeNextPath(typeof next === 'string' ? next : undefined);
  if (await getCurrentUser()) redirect(destination);
  const setupNeeded = !!appConfig(process.env).setupToken && (await prisma.user.count()) === 0;

  return (
    <main className={styles.page}>
      <div className={`card ${styles.card}`}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.lede}>Sign in to see our trips.</p>
        <LoginForm next={destination} />
        <p className={styles.footer}>
          {setupNeeded ? (
            <>
              First time here? <Link href="/setup">Set up the first admin account</Link>.
            </>
          ) : (
            'Forgot your password? Ask an admin for a reset link.'
          )}
        </p>
      </div>
    </main>
  );
}
