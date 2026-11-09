import { createHash, randomBytes } from 'node:crypto';

/** 256-bit random token, base64url (43 chars). Only its hash is stored. */
export const newToken = () => randomBytes(32).toString('base64url');

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');
