import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from './organization.entity';

/**
 * A place where an organisation's classes meet, with the pin and radius for in-person check-in
 * (ATT-15). Every organisation has one hidden default branch (`is_default`) that holds its own pin
 * and radius; its name may stay empty (the web app calls it "Main branch"). A section without a
 * branch meets at the default branch. Removing a branch keeps the row (is_active '0', removed_at/by).
 */
@Entity('branches')
@Index('IDX_branches_organization', ['organization_id'])
@Index('UQ_branches_default', ['organization_id'], { unique: true, where: '"is_default"' })
@Check('CHK_branches_radius', `"checkin_radius_m" BETWEEN 25 AND 1000`)
@Check('CHK_branches_pin', `("geo_lat" IS NULL) = ("geo_lng" IS NULL)`)
@Check('CHK_branches_name', `"name" IS NOT NULL OR "is_default"`)
export class BranchEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_branches_organization' })
  organization: OrganizationEntity;

  @ApiPropertyOptional({ example: 'Farmgate', description: 'Null only for the default branch' })
  @Column({ name: 'name', type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  /** PostgreSQL numeric comes back as a string. */
  @ApiPropertyOptional({ example: '23.758000' })
  @Column({ name: 'geo_lat', type: 'numeric', precision: 9, scale: 6, nullable: true })
  geo_lat: string | null;

  @ApiPropertyOptional({ example: '90.389000' })
  @Column({ name: 'geo_lng', type: 'numeric', precision: 9, scale: 6, nullable: true })
  geo_lng: string | null;

  @ApiProperty({ example: 100, description: 'Check-in radius in metres, 25–1000' })
  @Column({ name: 'checkin_radius_m', type: 'int', default: 100 })
  checkin_radius_m: number;

  @ApiProperty({ description: "The organisation's hidden default branch" })
  @Column({ name: 'is_default', type: 'boolean', default: false })
  is_default: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removed_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'removed_by', type: 'uuid', nullable: true })
  removed_by: string | null;
}
