import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassSessionEntity } from './class-session.entity';
import { LeaveRequestEntity } from './leave-request.entity';

/** A person's attendance in one class session (spec Epic 1, "Calendar colours"). */
export enum AttendanceStatusEnum {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  LEAVE = 'LEAVE',
}

/** Students and teachers check in the same way (ATT-11). */
export enum AttendancePersonTypeEnum {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
}

/**
 * How a record was made: a self check-in (P3-03), the closing job (P3-04; LEAVE instead of Absent for
 * someone on approved leave, P3-06), a paper register (P3-05) or a correction.
 */
export enum AttendanceRecordSourceEnum {
  SELF = 'SELF',
  AUTO_ABSENT = 'AUTO_ABSENT',
  IMPORT = 'IMPORT',
  CORRECTION = 'CORRECTION',
}

/** Why a saved check-in looks odd (ATT-04): shown to teachers and admins, never blocks the check-in. */
export enum AttendanceFlagEnum {
  /** Poor accuracy at the edge of the radius: the reported circle reaches outside it. */
  EDGE_ACCURACY = 'EDGE_ACCURACY',
  /** Too far from the person's previous in-person check-in for the time between them. */
  IMPOSSIBLE_JUMP = 'IMPOSSIBLE_JUMP',
}

/**
 * One person's attendance in one class session (design §9.4, table `class_attendance_records`).
 * `checked_in_at` is always the server's time. In-person self check-ins keep the position, the
 * distance to the branch pin and the reported accuracy. Corrections change `status` and leave a row
 * in `attendance_corrections` (ATT-12). A plain table for now; partitioning by `date` is in docs/TODO.md.
 */
@Entity('class_attendance_records')
@Index('UQ_class_attendance_records_person', ['class_attendance_id', 'person_id'], { unique: true })
@Index('IDX_class_attendance_records_person_date', ['organization_id', 'person_id', 'date'])
@Check('CHK_class_attendance_records_late', `"late_minutes" IS NULL OR "late_minutes" >= 0`)
export class AttendanceRecordEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'class_attendance_id', type: 'uuid' })
  class_attendance_id: string;

  @ManyToOne(() => ClassSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_attendance_id', foreignKeyConstraintName: 'FK_class_attendance_records_session' })
  session?: ClassSessionEntity;

  @ApiProperty({ description: "The session's date, copied for the per-person and monthly queries" })
  @Column({ name: 'date', type: 'date' })
  date: string;

  @ApiProperty()
  @Column({ name: 'person_id', type: 'uuid' })
  person_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'FK_class_attendance_records_person' })
  person?: UserEntity;

  @ApiProperty({ enum: AttendancePersonTypeEnum })
  @Column({ name: 'person_type', type: 'enum', enum: AttendancePersonTypeEnum, enumName: 'attendance_person_type' })
  person_type: AttendancePersonTypeEnum;

  @ApiProperty({ enum: AttendanceStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: AttendanceStatusEnum, enumName: 'attendance_status' })
  status: AttendanceStatusEnum;

  @ApiPropertyOptional({ description: 'Server time of the check-in' })
  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checked_in_at: Date | null;

  @ApiPropertyOptional({ description: 'Minutes after the start (Late only)' })
  @Column({ name: 'late_minutes', type: 'smallint', nullable: true })
  late_minutes: number | null;

  @ApiProperty({ enum: AttendanceRecordSourceEnum })
  @Column({ name: 'source', type: 'enum', enum: AttendanceRecordSourceEnum, enumName: 'attendance_record_source' })
  source: AttendanceRecordSourceEnum;

  /** PostgreSQL numeric comes back as a string. */
  @Column({ name: 'geo_lat', type: 'numeric', precision: 9, scale: 6, nullable: true })
  geo_lat: string | null;

  @Column({ name: 'geo_lng', type: 'numeric', precision: 9, scale: 6, nullable: true })
  geo_lng: string | null;

  @ApiPropertyOptional({ description: 'Metres from the branch pin (in-person check-ins)' })
  @Column({ name: 'distance_m', type: 'int', nullable: true })
  distance_m: number | null;

  @ApiPropertyOptional({ description: 'Accuracy the browser reported, in metres' })
  @Column({ name: 'accuracy_m', type: 'int', nullable: true })
  accuracy_m: number | null;

  @ApiPropertyOptional({ enum: AttendanceFlagEnum })
  @Column({ name: 'flag', type: 'varchar', length: 40, nullable: true })
  flag: AttendanceFlagEnum | null;

  @ApiPropertyOptional({ description: 'The approved leave request behind a LEAVE record (P3-06)' })
  @Column({ name: 'leave_request_id', type: 'uuid', nullable: true })
  leave_request_id: string | null;

  @ManyToOne(() => LeaveRequestEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'leave_request_id', foreignKeyConstraintName: 'FK_class_attendance_records_leave_request' })
  leave_request?: LeaveRequestEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;
}
