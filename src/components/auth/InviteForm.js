'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { addPasskey, guessDeviceName, passkeysSupported, wasCancelled } from '@/lib/passkey-client';
import { useBrowserFlag } from './useBrowserFlag';
import Field from './Field';
import styles from './auth.module.css';

export default function InviteForm({ token, username, purpose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const canUsePasskey = useBrowserFlag(passkeysSupported);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/invite', { method: 'POST', body: { token, password } });
      if (canUsePasskey) {
        setSignedIn(true);
        setBusy(false);
      } else {
        window.location.assign('/');
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const savePasskey = async () => {
    setBusy(true);
    setError('');
    try {
      await addPasskey(guessDeviceName());
      window.location.assign('/');
    } catch (err) {
      if (!wasCancelled(err)) setError(err.message);
      setBusy(false);
    }
  };

  if (signedIn) {
    return (
      <div className={styles.form}>
        <p className={styles.success} role="status">
          You&apos;re in! 🎉
        </p>
        <p className={styles.lede}>
          Want to skip the password next time? Save a passkey on this device and sign in with your face, fingerprint or
          screen lock.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="stack">
          <button type="button" className="btn btn-block" onClick={savePasskey} disabled={busy}>
            🔑 Save a passkey
          </button>
          {/* Full load (not client navigation) so the header picks up the new session. */}
          <button type="button" className="btn btn-secondary btn-block" onClick={() => window.location.assign('/')}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {/* Lets password managers save the new password against the right username. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      <Field
        label={purpose === 'reset' ? 'New password' : 'Choose a password'}
        hint="At least 10 characters. A short phrase works well."
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        value={password}
        onChange={setPassword}
      />
      <Field label="Type it again" type="password" autoComplete="new-password" required value={confirm} onChange={setConfirm} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-block" disabled={busy}>
        {busy ? 'Saving…' : purpose === 'reset' ? 'Reset password' : 'Join'}
      </button>
    </form>
  );
}
