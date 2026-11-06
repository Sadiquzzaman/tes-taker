import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from './organization.entity';

/** Which guardian SMS are sent (ATT-06, ATT-09, ATT-10). */
export interface GuardianSmsSwitches {
  late: boolean;
  absent: boolean;
  leave: boolean;
}

export const DEFAULT_GUARDIAN_SMS: GuardianSmsSwitches = { late: true, absent: true, leave: true };

/**
 * One row per organisation with its settings (design §9.1). Later epics add their columns
 * (weekly off days, guardian SMS switches, ...).
 */
/** Weekly off days that applied up to and including `until` (YYYY-MM-DD, organisation's time zone). */
export interface WeeklyOffDaysChange {
  days: number[];
  until: string;
}

@Entity('org_settings')
@Check('CHK_org_settings_repeat_absence_days', `"repeat_absence_days" BETWEEN 2 AND 30`)
@Check('CHK_org_settings_late_grace_minutes', `"late_grace_minutes" BETWEEN 0 AND 60`)
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

  // Attendance settings (ATT-01). The attendance module validates them; this module stores them.

  @ApiProperty({ type: [Number], description: 'Weekly off days, ISO day numbers (1 = Monday … 7 = Sunday); 5 = Friday' })
  @Column({ name: 'weekly_off_days', type: 'smallint', array: true, default: '{5}' })
  weekly_off_days: number[];

  @ApiProperty({ description: 'Earlier weekly off days, each with the last date it applied to, oldest first. A day opened later stays closed on dates it already covered.' })
  @Column({ name: 'weekly_off_days_history', type: 'jsonb', default: () => `'[]'` })
  weekly_off_days_history: WeeklyOffDaysChange[];

  @ApiProperty({ description: 'Guardian SMS switches: {"late":true,"absent":true,"leave":true}' })
  @Column({ name: 'guardian_sms', type: 'jsonb', default: () => `'{"late": true, "leave": true, "absent": true}'` })
  guardian_sms: GuardianSmsSwitches;

  @ApiProperty({ example: 10, description: 'Minutes after a class starts before a check-in is Late (ATT-06); 0–60; a section can override it' })
  @Column({ name: 'late_grace_minutes', type: 'smallint', default: 10 })
  late_grace_minutes: number;

  @ApiProperty({ description: 'Absent this many school days in a row alerts the class teacher (ATT-14)' })
  @Column({ name: 'repeat_absence_days', type: 'smallint', default: 3 })
  repeat_absence_days: number;
}
