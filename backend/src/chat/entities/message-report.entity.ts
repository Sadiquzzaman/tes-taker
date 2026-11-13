import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatTypeEnum } from './chat-access-log.entity';

export enum MessageReportStatusEnum {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum MessageReportResolutionEnum {
  KEPT = 'KEPT',
  DELETED = 'DELETED',
}

/** One message as it was, for a report's context. */
export interface ReportedMessage {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  files: string[];
  created_at: string;
  reported: boolean;
}

/** A member reported a message (COM-05), with the 5 messages before and after it as they were. */
@Entity('message_reports')
@Index('UQ_message_reports_message_reporter', ['message_id', 'reporter_id'], { unique: true })
@Index('IDX_message_reports_org_status', ['organization_id', 'status', 'created_at'])
@Check('CHK_message_reports_type', `"chat_type" IN ('GROUP', 'DIRECT')`)
@Check('CHK_message_reports_status', `"status" IN ('OPEN', 'RESOLVED')`)
@Check('CHK_message_reports_resolution', `"resolution" IS NULL OR "resolution" IN ('KEPT', 'DELETED')`)
export class MessageReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_message_reports_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'chat_type', type: 'varchar', length: 10 })
  chat_type: ChatTypeEnum;

  @Column({ name: 'chat_id', type: 'uuid' })
  chat_id: string;

  @Column({ name: 'message_id', type: 'uuid' })
  message_id: string;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporter_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id', foreignKeyConstraintName: 'FK_message_reports_reporter' })
  reporter?: UserEntity;

  @Column({ name: 'reason', type: 'varchar', length: 300 })
  reason: string;

  @Column({ name: 'context', type: 'jsonb' })
  context: ReportedMessage[];

  @Column({ name: 'status', type: 'varchar', length: 10, default: MessageReportStatusEnum.OPEN })
  status: MessageReportStatusEnum;

  @Column({ name: 'resolution', type: 'varchar', length: 10, nullable: true })
  resolution: MessageReportResolutionEnum | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolved_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by', foreignKeyConstraintName: 'FK_message_reports_resolver' })
  resolver?: UserEntity;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
