'use client';

import { useEffect, useId, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { passkeysSupported, passkeyAutofillSupported, signInWithPasskey, wasCancelled } from '@/lib/passkey-client';
import { useBrowserFlag } from './useBrowserFlag';
import styles from './auth.module.css';

export default function LoginForm({ next = '/' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canUsePasskey = useBrowserFlag(passkeysSupported);
  const userId = useId();
  const passwordId = useId();

  // Full page load so the header and every server component see the new session.
  const done = () => window.location.assign(next);

  // Offer saved passkeys in the username field's autofill suggestions.
  useEffect(() => {
    let active = true;
    passkeyAutofillSupported()
      .then((supported) => supported && active && signInWithPasskey({ autofill: true }))
      .then((user) => user && active && done())
      .catch((err) => {
        if (active && !wasCancelled(err)) setError(err.message);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: { username, password } });
      done();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const usePasskey = async () => {
    setBusy(true);
    setError('');
    try {
      await signInWithPasskey();
      done();
    } catch (err) {
      if (!wasCancelled(err)) setError(err.message);
      setBusy(false);
    }
  };

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        <label className="form-label" htmlFor={userId}>
          Username
        </label>
        <input
          id={userId}
          name="username"
          className="edit-input"
          autoComplete="username webauthn"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="form-label" htmlFor={passwordId}>
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          className="edit-input"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-block" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {canUsePasskey && (
        <>
          <div className={styles.divider}>or</div>
          <button type="button" className="btn btn-secondary btn-block" onClick={usePasskey} disabled={busy}>
            🔑 Sign in with a passkey
          </button>
        </>
      )}
    </>
  );
}
