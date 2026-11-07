import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { RoutineSlotEntity } from 'src/calendar/entities/routine-slot.entity';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * Where a class session stands: SCHEDULED until check-in closes, then CLOSED by the closing job
 * (missing students saved as Absent, ATT-10); CANCELLED when a teacher or admin cancels it (ATT-19).
 */
export enum ClassSessionStatusEnum {
  SCHEDULED = 'SCHEDULED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/**
 * One class session (design §9.4, table `class_attendance`): a section meeting on a date from one of
 * its weekly routine slots. The row is created on the first check-in or correction for that slot
 * and date (P3-04's worker may create the rest); `starts_at`/`ends_at` are the slot's times on that
 * date in the organisation's time zone, saved as instants, so a later schedule change does not
 * move a past session. A cancelled session keeps its row (and any check-ins) with who cancelled it.
 * A one-day change (P5-04, CAL-01) saves the session ahead with other times and/or a substitute
 * teacher, with who changed it, when and a note.
 */
@Entity('class_attendance')
@Index('UQ_class_attendance_slot_date', ['routine_slot_id', 'date'], { unique: true })
@Index('IDX_class_attendance_section_date', ['organization_id', 'section_id', 'date'])
@Index('IDX_class_attendance_org_date_status', ['organization_id', 'date', 'status'])
@Index('IDX_class_attendance_substitute', ['substitute_teacher_id', 'date'], { where: '"substitute_teacher_id" IS NOT NULL' })
@Check('CHK_class_attendance_times', `"ends_at" > "starts_at"`)
export class ClassSessionEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_class_attendance_section' })
  section?: SectionEntity;

  @ApiProperty()
  @Column({ name: 'routine_slot_id', type: 'uuid' })
  routine_slot_id: string;

  @ManyToOne(() => RoutineSlotEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routine_slot_id', foreignKeyConstraintName: 'FK_class_attendance_slot' })
  routine_slot?: RoutineSlotEntity;

  @ApiProperty({ example: '2026-11-07', description: "School day in the organisation's time zone" })
  @Column({ name: 'date', type: 'date' })
  date: string;

  @ApiProperty()
  @Column({ name: 'starts_at', type: 'timestamptz' })
  starts_at: Date;

  @ApiProperty()
  @Column({ name: 'ends_at', type: 'timestamptz' })
  ends_at: Date;

  @ApiProperty({ enum: ClassSessionStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: ClassSessionStatusEnum, enumName: 'class_session_status', default: ClassSessionStatusEnum.SCHEDULED })
  status: ClassSessionStatusEnum;

  @ApiPropertyOptional({ description: 'When the closing job saved the Absent records' })
  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closed_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by', foreignKeyConstraintName: 'FK_class_attendance_cancelled_by' })
  canceller?: UserEntity | null;

  @ApiPropertyOptional({ description: "The teacher's note to students" })
  @Column({ name: 'cancel_note', type: 'varchar', length: 300, nullable: true })
  cancel_note: string | null;

  @ApiPropertyOptional({ description: 'Teaches this one class instead of the routine\'s teacher (P5-04)' })
  @Column({ name: 'substitute_teacher_id', type: 'uuid', nullable: true })
  substitute_teacher_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'substitute_teacher_id', foreignKeyConstraintName: 'FK_class_attendance_substitute' })
  substitute?: UserEntity | null;

  @ApiPropertyOptional({ description: 'When the time or teacher was changed for this day' })
  @Column({ name: 'changed_at', type: 'timestamptz', nullable: true })
  changed_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'changed_by', type: 'uuid', nullable: true })
  changed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by', foreignKeyConstraintName: 'FK_class_attendance_changed_by' })
  changer?: UserEntity | null;

  @ApiPropertyOptional({ description: "The note to students about the change" })
  @Column({ name: 'change_note', type: 'varchar', length: 300, nullable: true })
  change_note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
