import Link from 'next/link';
import prisma from '@/lib/db';
import { inviteDetails } from '@/lib/api/auth';
import { runHandler } from '@/lib/api/run';
import InviteForm from '@/components/auth/InviteForm';
import styles from '@/components/auth/auth.module.css';

export const metadata = { title: 'Your invite', referrer: 'no-referrer', robots: { index: false } };

export default async function InvitePage({ params }) {
  const { token } = await params;
  const { status, body } = await runHandler(inviteDetails, { db: prisma, body: { token } });

  return (
    <main className={styles.page}>
      <div className={`card ${styles.card}`}>
        {status === 200 ? (
          <>
            <h1 className={styles.title}>
              {body.purpose === 'reset' ? 'Reset your password' : `Welcome, ${body.displayName}!`}
            </h1>
            <p className={styles.lede}>
              Your username is <strong>{body.username}</strong>.
              {body.purpose === 'reset' ? ' Pick a new password below.' : ' Pick a password to finish joining.'}
            </p>
            <InviteForm token={token} username={body.username} purpose={body.purpose} />
          </>
        ) : (
          <>
            <h1 className={styles.title}>This link has expired</h1>
            <p className={styles.lede}>{body.message}</p>
            <Link className="btn btn-secondary" href="/login">
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
