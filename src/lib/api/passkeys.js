// Passkeys (WebAuthn): add one to your account, or sign in with one.
// The WebAuthn library is injected as ctx.webauthn so tests can swap in a fake;
// the real @simplewebauthn/server does the cryptography in production.
import * as simpleWebauthn from '@simplewebauthn/server';
import { ok, fail, badRequest, conflict, isObject, text } from './run.js';
import { deny } from './guard.js';
import { newToken } from '../auth/tokens.js';
import { createRateLimiter } from '../auth/rate-limit.js';
import { limit, signIn } from './auth.js';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
// The login page asks for a challenge on every load (for passkey autofill), so
// this is looser than the sign-in limit while still capping stored challenges.
export const optionsLimiter = createRateLimiter({ limit: 120, windowMs: 15 * 60 * 1000 });
const PASSKEY_FAILED = "That passkey didn't work here. Try your password instead.";
const EXPIRED = 'That took too long. Please try again.';

const nowOf = (ctx) => ctx.now ?? new Date();
const lib = (ctx) => ctx.webauthn ?? simpleWebauthn;

function parseTransports(json) {
  try {
    const list = JSON.parse(json ?? '[]');
    return Array.isArray(list) ? list.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

async function saveChallenge(ctx, { challenge, purpose, userId = null }) {
  const now = nowOf(ctx);
  const id = newToken();
  await ctx.db.$transaction([
    ctx.db.authChallenge.deleteMany({ where: { expiresAt: { lt: now } } }),
    ctx.db.authChallenge.create({ data: { id, challenge, purpose, userId, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) } }),
  ]);
  return id;
}

/** Fetches and deletes (single use) a challenge; null unless it matches and is fresh. */
async function takeChallenge(ctx, id, purpose, userId = null) {
  if (typeof id !== 'string' || !id) return null;
  const row = await ctx.db.authChallenge.findUnique({ where: { id } });
  if (!row) return null;
  await ctx.db.authChallenge.deleteMany({ where: { id } });
  if (row.purpose !== purpose || row.userId !== userId || row.expiresAt <= nowOf(ctx)) return null;
  return row;
}

// ---- registration (signed in) ----

export async function registerOptions(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, config, user } = ctx;

  let handle = user.webauthnUserId;
  if (!handle) {
    handle = newToken();
    await db.user.update({ where: { id: user.id }, data: { webauthnUserId: handle } });
  }
  const existing = await db.passkey.findMany({ where: { userId: user.id }, select: { id: true, transports: true } });

  const options = await lib(ctx).generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userDisplayName: user.displayName,
    userID: new Uint8Array(Buffer.from(handle, 'base64url')),
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: parseTransports(p.transports) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  const challengeId = await saveChallenge(ctx, { challenge: options.challenge, purpose: 'register', userId: user.id });
  return ok({ options, challengeId });
}

export async function registerVerify(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, body, config, user } = ctx;
  if (!isObject(body)) return badRequest();

  const challenge = await takeChallenge(ctx, body.challengeId, 'register', user.id);
  if (!challenge) return badRequest(EXPIRED);

  let result;
  try {
    result = await lib(ctx).verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
    });
  } catch {
    return badRequest("Your device's passkey couldn't be verified. Please try again.");
  }
  if (!result?.verified || !result.registrationInfo) return badRequest("Your device's passkey couldn't be verified. Please try again.");

  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  if (await db.passkey.findUnique({ where: { id: credential.id } })) return conflict('That passkey is already saved.');

  const name = text(body.name)?.slice(0, 60) ?? 'Passkey';
  const passkey = await db.passkey.create({
    data: {
      id: credential.id,
      userId: user.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter ?? 0),
      transports: JSON.stringify(credential.transports ?? []),
      deviceType: credentialDeviceType ?? null,
      backedUp: !!credentialBackedUp,
      name,
    },
    select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
  });
  return ok({ passkey });
}

// ---- sign in (public) ----

export async function loginOptions(ctx) {
  const limited = limit(ctx, [`passkey-ip:${ctx.request?.ip}`], optionsLimiter);
  if (limited) return limited;
  // No allow list: the browser offers whichever discoverable passkeys it has for this site.
  const options = await lib(ctx).generateAuthenticationOptions({ rpID: ctx.config.rpID, userVerification: 'preferred' });
  const challengeId = await saveChallenge(ctx, { challenge: options.challenge, purpose: 'login' });
  return ok({ options, challengeId });
}

export async function loginVerify(ctx) {
  const limited = limit(ctx, [`passkey-ip:${ctx.request?.ip}`]);
  if (limited) return limited;
  const { db, body, config } = ctx;
  if (!isObject(body) || !isObject(body.response)) return badRequest();

  const challenge = await takeChallenge(ctx, body.challengeId, 'login');
  if (!challenge) return badRequest(EXPIRED);

  const credId = typeof body.response.id === 'string' ? body.response.id : '';
  const passkey = credId ? await db.passkey.findUnique({ where: { id: credId }, include: { user: true } }) : null;
  if (!passkey || !passkey.user.isActive) return fail(401, PASSKEY_FAILED);

  let result;
  try {
    result = await lib(ctx).verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: parseTransports(passkey.transports),
      },
    });
  } catch {
    return fail(401, PASSKEY_FAILED);
  }
  if (!result?.verified) return fail(401, PASSKEY_FAILED);

  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(result.authenticationInfo.newCounter ?? 0), lastUsedAt: nowOf(ctx) },
  });
  return signIn(ctx, passkey.user);
}
