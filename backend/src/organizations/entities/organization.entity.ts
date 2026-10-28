import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationKindEnum } from '../enums/organization-kind.enum';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';
import { WorkspaceTypeEnum } from '../enums/workspace-type.enum';

@Entity('organizations')
export class OrganizationEntity extends CustomBaseEntity {
  @ApiProperty({ example: 'ABC School' })
  @Column({ name: 'name', type: 'varchar', length: 200 })
  @Index()
  name: string;

  /** Sequential organization public id, e.g. 100001 */
  @ApiProperty({ example: '100001' })
  @Column({ name: 'public_id', type: 'varchar', length: 32, nullable: true })
  @Index({ unique: true })
  public_id: string | null;

  @ApiProperty({
    description: 'Legacy numeric organization number (starts at 100001)',
    example: 100001,
  })
  @Column({
    name: 'organization_number',
    type: 'bigint',
    unique: true,
    nullable: true,
  })
  @Index()
  organization_number: string | null;

  @ApiProperty({ enum: OrganizationStatusEnum })
  @Column({
    name: 'status',
    type: 'enum',
    enum: OrganizationStatusEnum,
    default: OrganizationStatusEnum.PENDING,
  })
  @Index()
  status: OrganizationStatusEnum;

  @ApiProperty({ enum: OrganizationKindEnum, description: 'SOLO = one teacher\'s own workspace (P2-01)' })
  @Column({
    name: 'kind',
    type: 'enum',
    enum: OrganizationKindEnum,
    default: OrganizationKindEnum.SCHOOL,
  })
  @Index()
  kind: OrganizationKindEnum;

  @ApiProperty({ enum: WorkspaceTypeEnum })
  @Column({
    name: 'workspace_type',
    type: 'enum',
    enum: WorkspaceTypeEnum,
    default: WorkspaceTypeEnum.ACADEMIC,
  })
  workspace_type: WorkspaceTypeEnum;

  @ApiProperty({ example: 'Asia/Dhaka' })
  @Column({ name: 'timezone', type: 'varchar', length: 64, default: 'Asia/Dhaka' })
  timezone: string;

  @ApiProperty({ example: 'bn', description: 'Language for members who have not chosen one' })
  @Column({ name: 'default_locale', type: 'varchar', length: 5, default: 'bn' })
  default_locale: string;

  @ApiPropertyOptional()
  @Column({ name: 'rejected_reason', type: 'varchar', length: 500, nullable: true })
  rejected_reason: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;
}
