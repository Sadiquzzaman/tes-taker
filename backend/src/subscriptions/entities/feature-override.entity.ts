import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

/**
 * A platform admin's switch for one organisation (FND-07): turn a feature on or off, or set a
 * limit, on top of the plan. It stops counting after `expires_at`.
 */
@Entity('feature_overrides')
@Index(['organization_id', 'key'], { unique: true })
export class FeatureOverrideEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ description: 'A feature key or a limit key (feature-catalog.ts)' })
  @Column({ name: 'key', type: 'varchar', length: 80 })
  key: string;

  @ApiProperty({ description: 'true/false for a feature, a number for a limit (0 = no limit)' })
  @Column({ name: 'value', type: 'jsonb' })
  value: boolean | number;

  @ApiPropertyOptional()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @ApiPropertyOptional({ description: 'Platform admin who set it' })
  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  granted_by: string | null;
}
