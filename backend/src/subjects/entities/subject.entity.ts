import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

@Index('UQ_subjects_global_name', ['name'], { unique: true, where: '"organization_id" IS NULL' })
@Index('UQ_subjects_org_name_code', ['organization_id', 'name', 'code'], {
  unique: true,
  where: '"organization_id" IS NOT NULL',
})
@Entity('subjects')
export class SubjectEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Display name of the subject', example: 'Mathematics' })
  @Column({ name: 'name', type: 'varchar', length: 150 })
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Short code, required for organization subjects', example: 'PHY-09' })
  @Column({ name: 'code', type: 'varchar', length: 50, nullable: true })
  code: string | null;

  @ApiPropertyOptional({ description: 'Set for organization catalog subjects; null = global catalog' })
  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity | null;
}
