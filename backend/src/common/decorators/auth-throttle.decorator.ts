import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Throttle, ThrottlerGetTrackerFunction } from '@nestjs/throttler';

/** Named throttler that caps unauthenticated auth routes per client IP. */
export const AUTH_IP_THROTTLER = 'auth-ip';

const AUTH_THROTTLE_METADATA = 'app:auth-throttle';
const ONE_MINUTE_MS = 60_000;

export interface AuthThrottleOptions {
  /** Body fields that identify the account (e.g. `phone`, `email`, `identifier`). */
  fields: string[];
  /** Requests allowed per IP + identifier in the window. */
  perIdentifier: number;
  /** Requests allowed per IP across all identifiers in the window. */
  perIp: number;
  /** Window length in ms (default one minute). */
  ttl?: number;
}

function normalizeIdentifier(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  return String(value).trim().toLowerCase().slice(0, 100);
}

/**
 * Tracker for login / OTP / reset routes: the client IP plus the account
 * identifier from the request body. It never trusts a bearer token, so a forged
 * JWT cannot move the request into a fresh bucket.
 */
export function ipAndIdentifierTracker(fields: string[]): ThrottlerGetTrackerFunction {
  return (req) => {
    const body = req?.body ?? {};
    const identifier = fields
      .map((field) => normalizeIdentifier(body[field]))
      .filter(Boolean)
      .join('|');
    return `${req.ip}:${identifier || '-'}`;
  };
}

/** True when the route handler carries `@AuthThrottle`. */
export function isAuthThrottled(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_THROTTLE_METADATA, context.getHandler()) === true;
}

/**
 * Rate limit for unauthenticated auth routes (design §8.2, review #5 and #10):
 * - `default` throttler: `perIdentifier` per IP + account identifier, so one
 *   account can't be brute-forced and one student's typos don't block the lab;
 * - `auth-ip` throttler: a higher `perIp` cap so a single IP can't spray many
 *   accounts, while 40 students behind one router can still log in together.
 */
export function AuthThrottle({ fields, perIdentifier, perIp, ttl = ONE_MINUTE_MS }: AuthThrottleOptions) {
  return applyDecorators(
    SetMetadata(AUTH_THROTTLE_METADATA, true),
    Throttle({
      default: { ttl, limit: perIdentifier, getTracker: ipAndIdentifierTracker(fields) },
      [AUTH_IP_THROTTLER]: { ttl, limit: perIp },
    }),
  );
}
