import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { AttendanceMethodEnum } from '../enums/attendance-method.enum';
import { ClassAttendanceModeEnum } from '../enums/class-attendance-mode.enum';
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
 * (attendance method, weekly off days, guardian SMS switches, ...).
 */
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

  // Attendance settings (P3-01, ATT-01). The attendance module validates them; this module stores them.
  //
  // UNUSED since P3-02 (class-based design, 5 Nov 2026): attendance_method, selfie_required,
  // class_attendance_mode, student_entry_time and teacher_entry_time are replaced by the per-section
  // mode, schedules and grace period. Nothing reads or writes them; a later release drops the columns
  // (expand → contract, owner decision 5 Nov 2026; docs/TODO.md).

  @ApiProperty({ enum: AttendanceMethodEnum, description: 'UNUSED since P3-02; dropped in a later release' })
  @Column({ name: 'attendance_method', type: 'enum', enum: AttendanceMethodEnum, enumName: 'attendance_method', default: AttendanceMethodEnum.OFF })
  attendance_method: AttendanceMethodEnum;

  @ApiProperty({ description: 'UNUSED since P3-02; dropped in a later release' })
  @Column({ name: 'selfie_required', type: 'boolean', default: false })
  selfie_required: boolean;

  @ApiProperty({ enum: ClassAttendanceModeEnum, description: 'UNUSED since P3-02; dropped in a later release' })
  @Column({
    name: 'class_attendance_mode',
    type: 'enum',
    enum: ClassAttendanceModeEnum,
    enumName: 'class_attendance_mode',
    default: ClassAttendanceModeEnum.PER_SESSION,
  })
  class_attendance_mode: ClassAttendanceModeEnum;

  @ApiProperty({ type: [Number], description: 'Weekly off days, ISO day numbers (1 = Monday … 7 = Sunday); 5 = Friday' })
  @Column({ name: 'weekly_off_days', type: 'smallint', array: true, default: '{5}' })
  weekly_off_days: number[];

  @ApiProperty({ example: '09:00:00', description: 'UNUSED since P3-02; dropped in a later release' })
  @Column({ name: 'student_entry_time', type: 'time', default: '09:00:00' })
  student_entry_time: string;

  @ApiProperty({ example: '08:45:00', description: 'UNUSED since P3-02; dropped in a later release' })
  @Column({ name: 'teacher_entry_time', type: 'time', default: '08:45:00' })
  teacher_entry_time: string;

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
