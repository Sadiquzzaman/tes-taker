import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1

function randomCode(length = 5): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export type PublicIdPrefix = 'USR' | 'TCH' | 'STD' | 'ORG' | 'CLS' | 'EXM' | 'MEM';

/**
 * Collision-safe human-readable public IDs.
 * Not for FKs or authorization — UUID remains the security boundary.
 */
export function generatePublicId(prefix: PublicIdPrefix): string {
  return `${prefix}-${randomCode(5)}`;
}
