import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit tracker that prefers the authenticated user id over the client IP.
 *
 * This matters for exams: many students often sit behind a single shared/NAT
 * IP (a school or lab). Keying authenticated traffic by user id prevents one
 * busy classroom from tripping an IP-based limit, while unauthenticated
 * endpoints (login, register, OTP, password reset) still fall back to IP so
 * brute-force attempts remain limited.
 *
 * The JWT is decoded (not verified) only to derive a bucket key — it is never
 * used for authorization.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader: unknown = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const userId = this.extractUserId(authHeader.slice(7));
      if (userId) {
        return `user:${userId}`;
      }
    }
    return req.ip;
  }

  private extractUserId(token: string): string | null {
    try {
      const [, payloadSegment] = token.split('.');
      if (!payloadSegment) {
        return null;
      }
      const decoded = JSON.parse(Buffer.from(payloadSegment, 'base64').toString('utf8'));
      return decoded?.id ?? decoded?.sub ?? null;
    } catch {
      return null;
    }
  }
}
