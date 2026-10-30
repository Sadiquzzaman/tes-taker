/** A JSON value as stored in `audit_logs.before/after`. */
export type AuditJson = string | number | boolean | null | AuditJson[] | { [key: string]: AuditJson };
export type AuditState = { [key: string]: AuditJson };

/** Keys never written to the audit log, at any depth: secrets, hashes and sign-in ids. */
const SECRET_KEY = /password|passcode|token|secret|credential|google_id|api_?key|(^|_)otp($|_)|hash$/i;

const MAX_DEPTH = 6;

/**
 * A copy of `value` that is safe to store in `audit_logs.before/after`: secret-looking keys are
 * dropped, dates become ISO strings, and functions and deep nesting are cut off. Callers should
 * still pass small objects with the fields that changed, not whole entities.
 */
export function sanitizeAuditValue(value: unknown, depth = 0): AuditJson | undefined {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value as string | number | boolean;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item, depth + 1)).filter((item): item is AuditJson => item !== undefined);
  }
  const out: AuditState = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    const clean = sanitizeAuditValue(item, depth + 1);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

/** `sanitizeAuditValue` for a before/after object; anything that is not an object is wrapped. */
export function sanitizeAuditState(value: unknown): AuditState | null {
  if (value === null || value === undefined) return null;
  const clean = sanitizeAuditValue(value);
  if (clean === null || clean === undefined) return null;
  return typeof clean === 'object' && !Array.isArray(clean) ? clean : { value: clean };
}

/**
 * Only the top-level fields that differ between two states, for an update's before/after:
 *   const { before, after } = auditChanges(planState(old), planState(saved));
 */
export function auditChanges(before: unknown, after: unknown): { before: AuditState | null; after: AuditState | null } {
  const oldState = sanitizeAuditState(before) ?? {};
  const newState = sanitizeAuditState(after) ?? {};
  const changedBefore: AuditState = {};
  const changedAfter: AuditState = {};
  for (const key of new Set([...Object.keys(oldState), ...Object.keys(newState)])) {
    if (JSON.stringify(oldState[key] ?? null) === JSON.stringify(newState[key] ?? null)) continue;
    changedBefore[key] = oldState[key] ?? null;
    changedAfter[key] = newState[key] ?? null;
  }
  return Object.keys(changedAfter).length ? { before: changedBefore, after: changedAfter } : { before: null, after: null };
}
