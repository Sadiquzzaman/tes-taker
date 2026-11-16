import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

export enum DevicePlatformEnum {
  WEB = 'WEB',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/** Why a device was signed out. */
export enum RefreshTokenRevokeReasonEnum {
  /** The user signed out on that device. */
  LOGOUT = 'LOGOUT',
  /** Signed out from another device ("sign out" in the device list, or "all other devices"). */
  SIGNED_OUT_ELSEWHERE = 'SIGNED_OUT_ELSEWHERE',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  /** A replaced token was used again after the grace period: treated as stolen. */
  REUSED = 'REUSED',
}

/**
 * One signed-in device (PM-01, design §8.2): its rotating refresh token, kept as a SHA-256 hash.
 * Login makes a row; refresh and switching workspace rotate the same row. Rows are never deleted:
 * signing out sets revoked_at and the reason.
 */
@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user', ['user_id', 'revoked_at'])
@Check('CHK_refresh_tokens_platform', `"platform" IN ('WEB', 'ANDROID', 'IOS')`)
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_refresh_tokens_user' })
  user?: UserEntity;

  /** SHA-256 of the current token; the token itself is never stored. */
  @Index('UQ_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  token_hash: string;

  /** The token it replaced, accepted for a short grace after rotating (two tabs refreshing at once). */
  @Index('IDX_refresh_tokens_previous_hash')
  @Column({ name: 'previous_hash', type: 'varchar', length: 64, nullable: true })
  previous_hash: string | null;

  @Column({ name: 'rotated_at', type: 'timestamptz', nullable: true })
  rotated_at: Date | null;

  @Column({ name: 'platform', type: 'varchar', length: 10, default: DevicePlatformEnum.WEB })
  platform: DevicePlatformEnum;

  /** "Chrome on Windows", or what the app sends ("Pixel 8"). */
  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  device_name: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 30, nullable: true })
  app_version: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', default: () => 'now()' })
  last_used_at: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expires_at: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 30, nullable: true })
  revoked_reason: RefreshTokenRevokeReasonEnum | null;
}
