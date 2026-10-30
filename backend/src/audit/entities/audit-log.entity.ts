import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * One recorded action (design §8.10): who did what, to which organisation and record, when.
 * Append-only: a trigger rejects UPDATE; rows go only with their organisation (design §10).
 * Written only by AuditService.
 */
@Entity('audit_logs')
@Index('IDX_audit_logs_organization_created', ['organization_id', 'created_at'])
@Index('IDX_audit_logs_entity', ['entity_type', 'entity_id'])
@Index('IDX_audit_logs_actor_created', ['actor_id', 'created_at'])
export class AuditLogEntity {
  @ApiProperty({ description: 'bigint, returned as a string' })
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ApiPropertyOptional({ description: 'Null for platform-wide actions (e.g. editing a plan)' })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ApiPropertyOptional({ description: 'Null for system actions' })
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actor_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserEntity;

  @ApiProperty({ example: 'member.role_change' })
  @Column({ name: 'action', type: 'varchar', length: 80 })
  action: string;

  @ApiPropertyOptional({ example: 'organization_member' })
  @Column({ name: 'entity_type', type: 'varchar', length: 60, nullable: true })
  entity_type: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entity_id: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'before', type: 'jsonb', nullable: true })
  before: object | null;

  @ApiPropertyOptional()
  @Column({ name: 'after', type: 'jsonb', nullable: true })
  after: object | null;

  @ApiPropertyOptional()
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @ApiPropertyOptional({ description: 'Shown to platform admins only' })
  @Column({ name: 'ip', type: 'inet', nullable: true })
  ip: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
