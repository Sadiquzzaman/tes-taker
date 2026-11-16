import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { RefreshTokenUtil } from 'src/common/utils/refresh-token.util';
import { DevicePlatformEnum, RefreshTokenEntity, RefreshTokenRevokeReasonEnum } from './entities/refresh-token.entity';
import { UserEntity } from './entities/user.entity';

/** What a client says about itself when it signs in or refreshes (the web sends nothing). */
export interface DeviceInfo {
  platform?: DevicePlatformEnum;
  name?: string | null;
  app_version?: string | null;
}

/** One device in "Signed-in devices". */
export interface SignedInDevice {
  id: string;
  platform: DevicePlatformEnum;
  device_name: string | null;
  app_version: string | null;
  created_at: Date;
  last_used_at: Date;
  current: boolean;
}

/** After a replaced token is used again within this time, it still counts (two tabs refreshing at once). */
export const ROTATION_GRACE_MS = 60_000;

const INVALID = 'Invalid or expired refresh token';

/**
 * Signed-in devices and their refresh tokens (PM-01, design §8.2). Each device has its own row in
 * `refresh_tokens`, so signing in on one device never signs another out. Tokens rotate on every
 * refresh and workspace switch; only their SHA-256 hashes are stored.
 */
@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokens: Repository<RefreshTokenEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly refreshTokenUtil: RefreshTokenUtil,
  ) {}

  /**
   * A new token for a device: rotates the device's row when `sessionId` names an active row of this
   * user (refresh, workspace switch), otherwise signs a new device in.
   */
  async issue(userId: string, sessionId?: string | null, device?: DeviceInfo): Promise<{ token: string; sessionId: string }> {
    const generated = this.refreshTokenUtil.generate();
    const now = new Date();
    if (sessionId) {
      const row = await this.tokens.findOne({ where: { id: sessionId, user_id: userId, revoked_at: IsNull() } });
      if (row && row.expires_at > now) {
        await this.tokens.update(
          { id: row.id },
          {
            previous_hash: row.token_hash,
            token_hash: generated.hash,
            rotated_at: now,
            last_used_at: now,
            expires_at: generated.expiresAt,
            ...(device?.app_version ? { app_version: device.app_version } : {}),
          },
        );
        return { token: generated.token, sessionId: row.id };
      }
    }
    const created = await this.tokens.save(
      this.tokens.create({
        user_id: userId,
        token_hash: generated.hash,
        platform: device?.platform ?? DevicePlatformEnum.WEB,
        device_name: device?.name?.trim().slice(0, 120) || null,
        app_version: device?.app_version?.trim().slice(0, 30) || null,
        last_used_at: now,
        expires_at: generated.expiresAt,
      }),
    );
    return { token: generated.token, sessionId: created.id };
  }

  /**
   * Checks a refresh token and tells which user and device it belongs to; the caller then issues
   * the device's next token with `issue(userId, sessionId)`. A token from before PM-01
   * (`users.refresh_token`) is moved into a new device row once. A replaced token used again after
   * the grace signs that device out (401).
   */
  async consume(token: string, device?: DeviceInfo): Promise<{ user: UserEntity; sessionId: string }> {
    const verification = this.refreshTokenUtil.verify(token);
    if (!verification.valid || verification.expired) {
      throw new UnauthorizedException(INVALID);
    }
    const hash = this.refreshTokenUtil.hash(token);
    const now = new Date();

    let row = await this.tokens.findOne({ where: { token_hash: hash } });
    if (!row) {
      row = await this.tokens.findOne({ where: { previous_hash: hash } });
      if (row && !row.revoked_at) {
        const withinGrace = row.rotated_at && now.getTime() - row.rotated_at.getTime() <= ROTATION_GRACE_MS;
        if (!withinGrace) {
          await this.revokeRow(row.id, RefreshTokenRevokeReasonEnum.REUSED);
          throw new UnauthorizedException(INVALID);
        }
      }
    }

    if (!row) {
      return this.consumeLegacy(hash, device);
    }
    if (row.revoked_at || row.expires_at <= now) {
      throw new UnauthorizedException(INVALID);
    }
    const user = await this.users.findOne({ where: { id: row.user_id } });
    if (!user) {
      throw new UnauthorizedException(INVALID);
    }
    return { user, sessionId: row.id };
  }

  /** A token kept in `users.refresh_token` before PM-01: becomes a device row, and the column is cleared. */
  private async consumeLegacy(hash: string, device?: DeviceInfo): Promise<{ user: UserEntity; sessionId: string }> {
    const user = await this.users.findOne({ where: { refresh_token: hash } });
    if (!user) {
      throw new UnauthorizedException(INVALID);
    }
    await this.users.update({ id: user.id }, { refresh_token: null as unknown as string });
    const { sessionId } = await this.issue(user.id, null, device);
    return { user, sessionId };
  }

  /** Signs out the device that holds this token (logout). Unknown or old tokens are ignored. */
  async revokeByToken(token: string): Promise<void> {
    if (!this.refreshTokenUtil.verify(token).valid) return;
    const hash = this.refreshTokenUtil.hash(token);
    const row =
      (await this.tokens.findOne({ where: { token_hash: hash } })) ??
      (await this.tokens.findOne({ where: { previous_hash: hash } }));
    if (row && !row.revoked_at) {
      await this.revokeRow(row.id, RefreshTokenRevokeReasonEnum.LOGOUT);
      return;
    }
    // A token from before PM-01: forget it.
    await this.users.update({ refresh_token: hash }, { refresh_token: null as unknown as string });
  }

  /** The user's signed-in devices, most recently used first. */
  async list(userId: string, currentSessionId?: string | null): Promise<SignedInDevice[]> {
    const rows = await this.tokens.find({
      where: { user_id: userId, revoked_at: IsNull(), expires_at: MoreThan(new Date()) },
      order: { last_used_at: 'DESC' },
    });
    return rows.map((row) => ({
      id: row.id,
      platform: row.platform,
      device_name: row.device_name,
      app_version: row.app_version,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      current: row.id === currentSessionId,
    }));
  }

  /** Signs out one of the user's own devices; another user's device, or one already out, is 404. */
  async revokeOne(userId: string, sessionId: string): Promise<void> {
    const row = await this.tokens.findOne({ where: { id: sessionId, user_id: userId, revoked_at: IsNull() } });
    if (!row) {
      throw new NotFoundException('Device not found');
    }
    await this.revokeRow(row.id, RefreshTokenRevokeReasonEnum.SIGNED_OUT_ELSEWHERE);
  }

  /**
   * Signs out every device of the user except `keepSessionId` (none kept when null). Also forgets a
   * token from before PM-01. Returns how many devices were signed out.
   */
  async revokeAll(userId: string, reason: RefreshTokenRevokeReasonEnum, keepSessionId?: string | null): Promise<number> {
    const where = keepSessionId
      ? { user_id: userId, revoked_at: IsNull(), id: Not(keepSessionId) }
      : { user_id: userId, revoked_at: IsNull() };
    const result = await this.tokens.update(where, { revoked_at: new Date(), revoked_reason: reason });
    await this.users.update({ id: userId }, { refresh_token: null as unknown as string });
    return result.affected ?? 0;
  }

  private async revokeRow(id: string, reason: RefreshTokenRevokeReasonEnum): Promise<void> {
    await this.tokens.update({ id, revoked_at: IsNull() }, { revoked_at: new Date(), revoked_reason: reason });
  }
}
