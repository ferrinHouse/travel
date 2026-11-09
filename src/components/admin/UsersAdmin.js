'use client';

import { useId, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Field from '@/components/auth/Field';
import When from '@/components/account/When';
import styles from '@/components/account/account.module.css';

const ROLES = [
  { value: 'viewer', label: 'Viewer: sees everything' },
  { value: 'member', label: 'Member: ticks and adds items' },
  { value: 'admin', label: 'Admin: plans trips, manages people' },
];

function LinkDialog({ link, onClose }) {
  const toast = useToast();
  const id = useId();
  if (!link) return null;
  const url = `${window.location.origin}/invite/${link.token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy failed. Select the link and copy it by hand.');
    }
  };
  return (
    <Modal open onClose={onClose} title={link.purpose === 'reset' ? `Reset link for ${link.name}` : `Invite link for ${link.name}`}>
      <p className={styles.sectionLede}>
        Text or email this to {link.name}. It works once and expires in {link.purpose === 'reset' ? '2 days' : '7 days'}.
        Anyone with the link can use it, so send it only to them.
      </p>
      <label className="form-label" htmlFor={id}>
        Link
      </label>
      <input id={id} className="edit-input" readOnly value={url} onFocus={(e) => e.target.select()} />
      <div className="form-actions">
        <button type="button" className="btn" onClick={copy}>
          Copy link
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function AddPerson({ onAdded }) {
  const [form, setForm] = useState({ displayName: '', username: '', role: 'viewer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const roleId = useId();
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await apiFetch('/api/users', { method: 'POST', body: form });
      onAdded(data.user, data.inviteToken);
      setForm({ displayName: '', username: '', role: 'viewer' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="add-person-heading">
      <h2 id="add-person-heading" className={styles.sectionTitle}>
        Add someone
      </h2>
      <p className={styles.sectionLede}>You&apos;ll get a one-time link to send them so they can pick their own password.</p>
      <form className={styles.form} onSubmit={submit}>
        <Field label="Name" hint="How they show up, e.g. “Grandma”." required value={form.displayName} onChange={set('displayName')} />
        <Field label="Username" hint="What they type to sign in. Lowercase, no spaces." autoCapitalize="none" spellCheck={false} required value={form.username} onChange={set('username')} />
        <label className="form-label" htmlFor={roleId}>
          Role
        </label>
        <select id={roleId} className="edit-input" value={form.role} onChange={(e) => set('role')(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="btn btn-md" disabled={busy}>
            {busy ? 'Adding…' : 'Add and get link'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function UsersAdmin({ initialUsers, currentUserId }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState(initialUsers);
  const [link, setLink] = useState(null);

  const replace = (user) => setUsers((list) => list.map((u) => (u.id === user.id ? user : u)));

  const update = async (user, patch) => {
    try {
      const data = await apiFetch('/api/users', { method: 'PATCH', body: { id: user.id, ...patch } });
      replace(data.user);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const toggleActive = async (user) => {
    if (user.isActive) {
      const ok = await confirm({
        title: `Turn off ${user.displayName}'s account?`,
        message: 'They will be signed out everywhere and unable to sign in until you turn it back on.',
        confirmLabel: 'Turn off',
        danger: true,
      });
      if (!ok) return;
    }
    if (await update(user, { isActive: !user.isActive })) {
      toast.success(user.isActive ? `${user.displayName} is turned off` : `${user.displayName} can sign in again`);
    }
  };

  const makeLink = async (user) => {
    try {
      const data = await apiFetch('/api/users/link', { method: 'POST', body: { id: user.id } });
      setLink({ token: data.token, purpose: data.purpose, name: user.displayName });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const signOutEverywhere = async (user) => {
    try {
      const data = await apiFetch('/api/users/sessions', { method: 'DELETE', body: { id: user.id } });
      toast.success(`Signed ${user.displayName} out of ${data.revoked} device${data.revoked === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className={styles.sections}>
      <section className="card" aria-labelledby="people-heading">
        <h2 id="people-heading" className={styles.sectionTitle}>
          Everyone
        </h2>
        <ul className={styles.list}>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <li key={u.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>
                    {u.displayName}
                    {isSelf && <span className={styles.badge}>You</span>}
                    {!u.isActive && <span className={`${styles.badge} ${styles.badgeMuted}`}>Off</span>}
                    {u.isActive && !u.hasPassword && u.passkeyCount === 0 && (
                      <span className={`${styles.badge} ${styles.badgeMuted}`}>Invite pending</span>
                    )}
                  </p>
                  <p className={styles.rowMeta}>
                    @{u.username} · {u.passkeyCount} passkey{u.passkeyCount === 1 ? '' : 's'} · Last signed in{' '}
                    <When value={u.lastLoginAt} />
                  </p>
                </div>
                <div className={styles.rowActions}>
                  <select
                    className={`edit-input ${styles.inlineInput}`}
                    aria-label={`Role for ${u.displayName}`}
                    value={u.role}
                    disabled={isSelf}
                    onChange={(e) => update(u, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.value[0].toUpperCase() + r.value.slice(1)}
                      </option>
                    ))}
                  </select>
                  {u.isActive && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => makeLink(u)}>
                      {u.hasPassword ? 'Reset link' : 'Invite link'}
                    </button>
                  )}
                  {!isSelf && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => signOutEverywhere(u)}>
                        Sign out everywhere
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleActive(u)}>
                        {u.isActive ? 'Turn off' : 'Turn on'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <AddPerson
        onAdded={(user, token) => {
          setUsers((list) => [...list, user]);
          setLink({ token, purpose: 'invite', name: user.displayName });
        }}
      />

      <LinkDialog link={link} onClose={() => setLink(null)} />
    </div>
  );
}
