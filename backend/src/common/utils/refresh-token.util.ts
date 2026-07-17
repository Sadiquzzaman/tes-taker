import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface GeneratedRefreshToken {
  /** Opaque token handed to the client. Never stored in plaintext. */
  token: string;
  /** SHA-256 hash of the token — this is what gets persisted. */
  hash: string;
  /** Absolute expiry time. */
  expiresAt: Date;
}

export interface RefreshTokenVerification {
  /** Signature is authentic and the token is well-formed. */
  valid: boolean;
  /** Signature is authentic but the token is past its expiry. */
  expired: boolean;
}

/**
 * Produces and verifies refresh tokens.
 *
 * Security properties:
 * - Cryptographically secure randomness (crypto.randomBytes).
 * - Self-describing expiry, protected by an HMAC signature so it cannot be
 *   tampered with — no extra database column is required.
 * - Only the SHA-256 hash of the token is stored, so a database leak does not
 *   expose usable refresh tokens.
 *
 * Token format: `<random>.<expiryMs>.<hmac>`
 */
@Injectable()
export class RefreshTokenUtil {
  constructor(private readonly configService: ConfigService) {}

  private getSecret(): string {
    return (
      this.configService.get<string>('REFRESH_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'change-this-refresh-secret'
    );
  }

  private getTtlMs(): number {
    const days = Number(this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
    return safeDays * 24 * 60 * 60 * 1000;
  }

  private sign(data: string): string {
    return createHmac('sha256', this.getSecret()).update(data).digest('hex');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generate(): GeneratedRefreshToken {
    const random = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.getTtlMs());
    const payload = `${random}.${expiresAt.getTime()}`;
    const signature = this.sign(payload);
    const token = `${payload}.${signature}`;

    return {
      token,
      hash: this.hash(token),
      expiresAt,
    };
  }

  verify(token: string): RefreshTokenVerification {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, expired: false };
    }

    const [random, expiryStr, signature] = parts;
    const expected = this.sign(`${random}.${expiryStr}`);

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return { valid: false, expired: false };
    }

    const expiryMs = Number(expiryStr);
    if (!Number.isFinite(expiryMs)) {
      return { valid: false, expired: false };
    }

    if (Date.now() > expiryMs) {
      return { valid: true, expired: true };
    }

    return { valid: true, expired: false };
  }
}
