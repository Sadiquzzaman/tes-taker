import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NotificationChannelEnum } from '../notification.constants';

/**
 * The text of a message for one event, channel and language (design §8.6), with `{{variables}}`.
 * `organization_id` null = the platform default; an organisation's own row wins over it (no
 * screen for organisation templates yet). Missing defaults are added at start-up; edits are kept.
 */
@Entity('message_templates')
@Index('UQ_message_templates_platform', ['event_type', 'channel', 'locale'], {
  unique: true,
  where: '"organization_id" IS NULL',
})
@Index('UQ_message_templates_organization', ['organization_id', 'event_type', 'channel', 'locale'], {
  unique: true,
  where: '"organization_id" IS NOT NULL',
})
@Check('CHK_message_templates_channel', `"channel" IN ('IN_APP', 'EMAIL', 'SMS')`)
@Check('CHK_message_templates_locale', `"locale" IN ('bn', 'en')`)
export class MessageTemplateEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional({ description: 'Null = platform default' })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ApiProperty({ example: 'exam.scheduled' })
  @Column({ name: 'event_type', type: 'varchar', length: 60 })
  event_type: string;

  @ApiProperty({ enum: NotificationChannelEnum })
  @Column({ name: 'channel', type: 'varchar', length: 10 })
  channel: NotificationChannelEnum;

  @ApiProperty({ example: 'bn' })
  @Column({ name: 'locale', type: 'varchar', length: 5 })
  locale: string;

  @ApiPropertyOptional({ description: 'Email subject or in-app title' })
  @Column({ name: 'subject', type: 'varchar', length: 200, nullable: true })
  subject: string | null;

  @ApiProperty({ description: 'With {{variables}}; HTML for email' })
  @Column({ name: 'body', type: 'text' })
  body: string;

  @ApiPropertyOptional()
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
