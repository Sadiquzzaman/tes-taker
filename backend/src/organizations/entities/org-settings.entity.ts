import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from './organization.entity';

/**
 * One row per organisation with its settings (design §9.1). Later epics add their columns
 * (attendance method, weekly off days, guardian SMS switches, ...).
 */
@Entity('org_settings')
@Check('CHK_org_settings_sms_locale', `"sms_locale" IS NULL OR "sms_locale" IN ('bn', 'en')`)
export class OrgSettingsEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index({ unique: true })
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ description: 'Sections have a class teacher (FND-02). Default: on for schools, off for solo teachers' })
  @Column({ name: 'class_teacher_enabled', type: 'boolean', default: true })
  class_teacher_enabled: boolean;

  @ApiPropertyOptional({ description: 'When the academic setup wizard was finished (P2-04); null = not yet' })
  @Column({ name: 'setup_completed_at', type: 'timestamptz', nullable: true })
  setup_completed_at: Date | null;

  @ApiPropertyOptional({ description: "Guardian SMS language, bn | en (FND-10); null = the organisation's default language" })
  @Column({ name: 'sms_locale', type: 'varchar', length: 5, nullable: true })
  sms_locale: string | null;
}
