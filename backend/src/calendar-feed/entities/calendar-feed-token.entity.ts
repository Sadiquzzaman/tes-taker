import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * A person's private calendar subscription link (CAL-07): Google or Apple Calendar reads
 * `GET /calendar/ical/:token`. With an organisation it covers that workspace; without one
 * (personal, migration PersonalCalendarLinks) it covers every workspace the person belongs to. Only a SHA-256 of the token is kept; a new link
 * revokes the old one (revoked_at), and turning it off revokes it too. Rows are kept.
 */
@Entity('calendar_feed_tokens')
@Index('UQ_calendar_feed_tokens_hash', ['token_hash'], { unique: true })
@Index('IDX_calendar_feed_tokens_user', ['organization_id', 'user_id'])
@Index('IDX_calendar_feed_tokens_personal', ['user_id'], { where: '"organization_id" IS NULL' })
export class CalendarFeedTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null: a personal link across all the person's workspaces. */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_calendar_feed_tokens_user' })
  user?: UserEntity;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  token_hash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  last_used_at: Date | null;
}
