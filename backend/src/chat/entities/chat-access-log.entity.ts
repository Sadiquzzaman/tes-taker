import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

export enum ChatTypeEnum {
  GROUP = 'GROUP',
  DIRECT = 'DIRECT',
}

/** An owner or admin opened a chat (COM-04): who, which, when and why. Every opening is kept. */
@Entity('chat_access_logs')
@Index('IDX_chat_access_logs_org_opened', ['organization_id', 'opened_at'])
@Index('IDX_chat_access_logs_actor_chat', ['actor_id', 'chat_id', 'opened_at'])
@Check('CHK_chat_access_logs_type', `"chat_type" IN ('GROUP', 'DIRECT')`)
export class ChatAccessLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_chat_access_logs_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'actor_id', type: 'uuid' })
  actor_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'FK_chat_access_logs_actor' })
  actor?: UserEntity;

  @Column({ name: 'chat_type', type: 'varchar', length: 10 })
  chat_type: ChatTypeEnum;

  @Column({ name: 'chat_id', type: 'uuid' })
  chat_id: string;

  @Column({ name: 'reason', type: 'varchar', length: 300 })
  reason: string;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'now()' })
  opened_at: Date;
}
