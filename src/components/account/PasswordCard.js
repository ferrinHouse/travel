'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import Field from '@/components/auth/Field';
import styles from './account.module.css';

export default function PasswordCard({ username, hasPassword: initialHasPassword }) {
  const toast = useToast();
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/account/password', {
        method: 'POST',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setHasPassword(true);
      toast.success('Password saved. Your other devices were signed out.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="password-heading">
      <h2 id="password-heading" className={styles.sectionTitle}>
        Password
      </h2>
      <p className={styles.sectionLede}>
        {hasPassword ? 'Changing it signs you out everywhere else.' : 'You sign in with a passkey. Add a password as a backup.'}
      </p>
      <form className={styles.form} onSubmit={submit}>
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        {hasPassword && (
          <Field label="Current password" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} />
        )}
        <Field label="New password" hint="At least 10 characters." type="password" autoComplete="new-password" required minLength={10} value={form.newPassword} onChange={set('newPassword')} />
        <Field label="Type it again" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="btn btn-md" disabled={busy}>
            {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Add password'}
          </button>
        </div>
      </form>
    </section>
  );
}
