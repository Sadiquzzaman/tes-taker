import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { GradingBandEntity } from './grading-band.entity';

/**
 * A grading scale (FND-11): percentage bands → grade and GPA. `organization_id` null with
 * `is_default` is the platform default (Bangladesh national); an organisation that edits its
 * bands gets its own scale. Rows are never deleted: saving new bands or resetting to the default
 * deactivates the organisation's current scale (`is_active` 0, with when and by whom) so
 * earlier versions stay. At most one active scale per organisation, and one platform default.
 */
@Entity('grading_scales')
@Index('UQ_grading_scales_active_org', ['organization_id'], {
  unique: true,
  where: `"organization_id" IS NOT NULL AND "is_active" = '1'`,
})
@Index('UQ_grading_scales_platform_default', ['is_default'], {
  unique: true,
  where: `"is_default" = true AND "is_active" = '1'`,
})
export class GradingScaleEntity extends CustomBaseEntity {
  @ApiPropertyOptional({ description: 'null = platform default' })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ example: 'Bangladesh national' })
  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @ApiProperty({ description: 'The platform default scale' })
  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivated_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'deactivated_by', type: 'uuid', nullable: true })
  deactivated_by: string | null;

  @OneToMany(() => GradingBandEntity, (band) => band.scale)
  bands: GradingBandEntity[];
}
