import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

/**
 * A holiday or closure (CAL-04): one day or a range of school days in the organisation's time zone.
 * Removing one keeps the row (is_active '0', removed_at/by), so history is never lost.
 */
@Entity('holidays')
@Index('IDX_holidays_organization_date_from', ['organization_id', 'date_from'])
@Check('CHK_holidays_date_range', `"date_to" >= "date_from"`)
export class HolidayEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_holidays_organization' })
  organization: OrganizationEntity;

  @ApiProperty({ example: '2026-12-16' })
  @Column({ name: 'date_from', type: 'date' })
  date_from: string;

  @ApiProperty({ example: '2026-12-16', description: 'Same as date_from for a single day' })
  @Column({ name: 'date_to', type: 'date' })
  date_to: string;

  @ApiPropertyOptional({ example: 'Victory Day', description: 'Optional note' })
  @Column({ name: 'name', type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @ApiPropertyOptional({ description: 'When the holiday was removed; null while it is in force' })
  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removed_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'removed_by', type: 'uuid', nullable: true })
  removed_by: string | null;
}
