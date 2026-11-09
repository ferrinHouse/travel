'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { addPasskey, guessDeviceName, passkeysSupported, wasCancelled } from '@/lib/passkey-client';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useBrowserFlag } from '@/components/auth/useBrowserFlag';
import When from './When';
import styles from './account.module.css';

function PasskeyRow({ passkey, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(passkey.name);

  const save = async (e) => {
    e.preventDefault();
    if (await onRename(name)) setEditing(false);
  };

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        {editing ? (
          <form className="cluster" onSubmit={save}>
            <input
              className={`edit-input ${styles.inlineInput}`}
              aria-label="Passkey name"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-sm">
              Save
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <p className={styles.rowTitle}>
              🔑 {passkey.name}
              {passkey.backedUp && <span className={`${styles.badge} ${styles.badgeMuted}`}>Synced</span>}
            </p>
            <p className={styles.rowMeta}>
              Added <When value={passkey.createdAt} /> · Last used <When value={passkey.lastUsedAt} />
            </p>
          </>
        )}
      </div>
      {!editing && (
        <div className={styles.rowActions}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} aria-label={`Rename ${passkey.name}`}>
            Rename
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onDelete} aria-label={`Remove ${passkey.name}`}>
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

export default function PasskeysCard({ initialPasskeys }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [busy, setBusy] = useState(false);
  const supported = useBrowserFlag(passkeysSupported);

  const add = async () => {
    setBusy(true);
    try {
      const passkey = await addPasskey(guessDeviceName());
      setPasskeys((list) => [...list, passkey]);
      toast.success('Passkey saved. Next time, just pick it from the sign-in page.');
    } catch (err) {
      if (!wasCancelled(err)) toast.error(`Couldn't save the passkey: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const rename = async (passkey, name) => {
    try {
      const data = await apiFetch('/api/account/passkeys', { method: 'PATCH', body: { id: passkey.id, name } });
      setPasskeys((list) => list.map((p) => (p.id === passkey.id ? { ...p, name: data.passkey.name } : p)));
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const remove = async (passkey) => {
    const ok = await confirm({
      title: 'Remove passkey?',
      message: `“${passkey.name}” won't be able to sign you in any more. Also delete it from the device's password manager.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch('/api/account/passkeys', { method: 'DELETE', body: { id: passkey.id } });
      setPasskeys((list) => list.filter((p) => p.id !== passkey.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="card" aria-labelledby="passkeys-heading">
      <h2 id="passkeys-heading" className={styles.sectionTitle}>
        Passkeys
      </h2>
      <p className={styles.sectionLede}>Sign in with your face, fingerprint or screen lock instead of typing a password.</p>
      {passkeys.length === 0 ? (
        <p className={styles.empty}>No passkeys yet.</p>
      ) : (
        <ul className={styles.list}>
          {passkeys.map((p) => (
            <PasskeyRow key={p.id} passkey={p} onRename={(name) => rename(p, name)} onDelete={() => remove(p)} />
          ))}
        </ul>
      )}
      {supported ? (
        <button type="button" className="btn btn-md" onClick={add} disabled={busy}>
          {busy ? 'Waiting for your device…' : 'Add a passkey on this device'}
        </button>
      ) : (
        <p className={styles.empty}>This browser can&apos;t save passkeys.</p>
      )}
    </section>
  );
}
