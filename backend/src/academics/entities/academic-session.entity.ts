import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

export enum AcademicSessionStatusEnum {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

/**
 * A school year or coaching term (FND-01). Several can be ACTIVE at once; exactly one per
 * organisation is the default. Closing one makes its records read-only; only the Owner reopens it.
 */
@Entity('academic_sessions')
@Index(['organization_id', 'status'])
@Index('UQ_academic_sessions_default', ['organization_id'], { unique: true, where: '"is_default" = true' })
export class AcademicSessionEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ example: '2026' })
  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  @ApiProperty({ example: '2026-01-01', description: 'Date in the organisation time zone' })
  @Column({ name: 'start_date', type: 'date' })
  start_date: string;

  @ApiProperty({ example: '2026-12-31' })
  @Column({ name: 'end_date', type: 'date' })
  end_date: string;

  @ApiProperty({ enum: AcademicSessionStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: AcademicSessionStatusEnum, default: AcademicSessionStatusEnum.ACTIVE })
  status: AcademicSessionStatusEnum;

  @ApiProperty()
  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default: boolean;
}
