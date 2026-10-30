import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { NotificationOutboxEntity } from './notification-outbox.entity';

/**
 * One message in a user's in-app inbox (the top-bar bell, FND-12). Written by the worker when it
 * sends an IN_APP outbox row (once per row: `outbox_id` is unique). Kept when read (`read_at`).
 */
@Entity('notifications')
@Index('IDX_notifications_user_read_created', ['user_id', 'read_at', 'created_at'])
@Index('UQ_notifications_outbox', ['outbox_id'], { unique: true, where: '"outbox_id" IS NOT NULL' })
export class NotificationEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @ApiPropertyOptional()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ApiPropertyOptional()
  @Column({ name: 'outbox_id', type: 'uuid', nullable: true })
  outbox_id: string | null;

  @ManyToOne(() => NotificationOutboxEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'outbox_id' })
  outbox?: NotificationOutboxEntity;

  @ApiProperty({ example: 'exam.scheduled' })
  @Column({ name: 'type', type: 'varchar', length: 60 })
  type: string;

  @ApiProperty()
  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @ApiPropertyOptional()
  @Column({ name: 'body', type: 'text', nullable: true })
  body: string | null;

  @ApiPropertyOptional({ description: 'A path in the web app, e.g. /billing' })
  @Column({ name: 'link', type: 'varchar', length: 300, nullable: true })
  link: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  read_at: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
