'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Field from './Field';
import styles from './auth.module.css';

export default function SetupForm() {
  const [form, setForm] = useState({ token: '', username: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/setup', { method: 'POST', body: form });
      window.location.assign('/account?welcome=1');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field label="Setup code" hint="The SETUP_TOKEN value from the server's secrets." type="password" autoComplete="off" required value={form.token} onChange={set('token')} />
      <Field label="Username" hint="Lowercase letters, numbers, dots or dashes." autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.username} onChange={set('username')} />
      <Field label="Your name" hint="Shown to the family, e.g. “Dad”." autoComplete="name" required value={form.displayName} onChange={set('displayName')} />
      <Field label="Password" hint="At least 10 characters. A short phrase works well." type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={set('password')} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-block" disabled={busy}>
        {busy ? 'Creating…' : 'Create admin account'}
      </button>
    </form>
  );
}
