import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { NotificationChannelEnum, OutboxStatusEnum, RecipientTypeEnum } from '../notification.constants';

/**
 * Every outgoing message (design §8.6, FND-12, FND-14). Written by NotificationsService.enqueue,
 * in the same transaction as the change that caused it; sent by the worker. It is also the message
 * log. A plain table for now; monthly partitioning is in docs/TODO.md.
 */
@Entity('notification_outbox')
@Index('IDX_notification_outbox_status_send_after', ['status', 'send_after'])
@Index('IDX_notification_outbox_organization_created', ['organization_id', 'created_at'])
@Index('IDX_notification_outbox_recipient_created', ['recipient_id', 'created_at'])
@Check('CHK_notification_outbox_channel', `"channel" IN ('IN_APP', 'EMAIL', 'SMS')`)
@Check(
  'CHK_notification_outbox_status',
  `"status" IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'NO_CREDIT')`,
)
@Check('CHK_notification_outbox_recipient_type', `"recipient_type" IN ('USER', 'GUARDIAN', 'ADDRESS')`)
export class NotificationOutboxEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional({ description: 'Null for platform messages (sign-up codes, platform admin notices)' })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ApiProperty({ example: 'exam.scheduled' })
  @Column({ name: 'event_type', type: 'varchar', length: 60 })
  event_type: string;

  @ApiProperty({ enum: RecipientTypeEnum })
  @Column({ name: 'recipient_type', type: 'varchar', length: 10 })
  recipient_type: RecipientTypeEnum;

  @ApiPropertyOptional({ description: 'The user (or guardian) the message is for' })
  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipient_id: string | null;

  @ApiPropertyOptional({ description: 'Phone or email; filled from the recipient at send time when empty' })
  @Column({ name: 'to_address', type: 'varchar', length: 200, nullable: true })
  to_address: string | null;

  @ApiProperty({ enum: NotificationChannelEnum })
  @Column({ name: 'channel', type: 'varchar', length: 10 })
  channel: NotificationChannelEnum;

  @ApiPropertyOptional({ description: 'bn | en; chosen at send time when empty' })
  @Column({ name: 'locale', type: 'varchar', length: 5, nullable: true })
  locale: string | null;

  @ApiProperty({ description: 'Template variables' })
  @Column({ name: 'payload', type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Rendered subject (email), filled at send time' })
  @Column({ name: 'subject', type: 'varchar', length: 200, nullable: true })
  subject: string | null;

  @ApiPropertyOptional({ description: 'Rendered message, filled at send time (hidden for codes)' })
  @Column({ name: 'body', type: 'text', nullable: true })
  body: string | null;

  @ApiPropertyOptional({ description: 'Unique: a second enqueue with the same key is ignored' })
  @Index('UQ_notification_outbox_dedupe_key', { unique: true })
  @Column({ name: 'dedupe_key', type: 'varchar', length: 200, nullable: true })
  dedupe_key: string | null;

  @ApiProperty({ enum: OutboxStatusEnum })
  @Column({ name: 'status', type: 'varchar', length: 20, default: OutboxStatusEnum.PENDING })
  status: OutboxStatusEnum;

  @ApiProperty({ description: 'Sent ahead of other waiting messages (sign-up codes)' })
  @Column({ name: 'urgent', type: 'boolean', default: false })
  urgent: boolean;

  @ApiPropertyOptional({ description: 'Not before this time (also the next retry)' })
  @Column({ name: 'send_after', type: 'timestamptz', nullable: true })
  send_after: Date | null;

  @ApiProperty()
  @Column({ name: 'attempts', type: 'smallint', default: 0 })
  attempts: number;

  @ApiPropertyOptional()
  @Column({ name: 'provider_msg_id', type: 'varchar', length: 100, nullable: true })
  provider_msg_id: string | null;

  @ApiProperty({ description: 'SMS credits charged (segments); 0 for other channels and platform messages' })
  @Column({ name: 'credits_used', type: 'smallint', default: 0 })
  credits_used: number;

  @ApiPropertyOptional()
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @ApiPropertyOptional({ description: 'Who caused it (null for system messages)' })
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
