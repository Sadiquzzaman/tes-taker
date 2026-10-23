import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Rate-limit tracker that prefers the authenticated user id over the client IP.
 *
 * This matters for exams: many students often sit behind a single shared/NAT
 * IP (a school or lab). Keying authenticated traffic by user id prevents one
 * busy classroom from tripping an IP-based limit.
 *
 * The bearer token is only used as a key after its signature and expiry are
 * verified; a forged, unsigned or expired token falls back to the IP, so it
 * cannot buy a fresh bucket per request. Login, OTP and reset routes use
 * `@AuthThrottle`, which keys by IP + account identifier instead.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: { headers?: { authorization?: unknown }; ip?: string }): Promise<string> {
    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const userId = this.verifiedUserId(authHeader.slice(7));
      if (userId) {
        return `user:${userId}`;
      }
    }
    return req.ip ?? '';
  }

  private verifiedUserId(token: string): string | null {
    try {
      const payload = this.jwtService.verify<{ id?: string; sub?: string }>(token);
      return payload?.id ?? payload?.sub ?? null;
    } catch {
      return null;
    }
  }
}
