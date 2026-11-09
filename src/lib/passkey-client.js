'use client';

// Browser half of passkeys: asks the server for a challenge, hands it to the
// device (Face ID, Touch ID, Windows Hello, a phone…), and sends the answer back.
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { apiFetch } from './api-client';

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();
export const passkeyAutofillSupported = () => browserSupportsWebAuthnAutofill();

/** True when the person simply closed the device prompt (not worth an error). */
export function wasCancelled(error) {
  return error?.name === 'NotAllowedError' || error?.name === 'AbortError' || error?.code === 'ERROR_CEREMONY_ABORTED';
}

/**
 * Signs in with a passkey. With `autofill`, waits quietly for the person to
 * pick a passkey from the username field's suggestions instead of prompting.
 */
export async function signInWithPasskey({ autofill = false } = {}) {
  const { options, challengeId } = await apiFetch('/api/auth/passkey/options', { method: 'POST', body: {} });
  const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill: autofill });
  const data = await apiFetch('/api/auth/passkey/verify', { method: 'POST', body: { challengeId, response } });
  return data.user;
}

/** Adds a passkey on this device to the signed-in account. */
export async function addPasskey(name) {
  const { options, challengeId } = await apiFetch('/api/account/passkeys/options', { method: 'POST', body: {} });
  const response = await startRegistration({ optionsJSON: options });
  const data = await apiFetch('/api/account/passkeys/verify', { method: 'POST', body: { challengeId, response, name } });
  return data.passkey;
}


export { guessDeviceName } from './device-name';
