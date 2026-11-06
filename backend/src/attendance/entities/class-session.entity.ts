import { ApiProperty } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { RoutineSlotEntity } from 'src/calendar/entities/routine-slot.entity';

/** Where a class session stands. P3-03 creates SCHEDULED rows; P3-04 closes and cancels them (ATT-10, ATT-19). */
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
 * move a past session.
 */
@Entity('class_attendance')
@Index('UQ_class_attendance_slot_date', ['routine_slot_id', 'date'], { unique: true })
@Index('IDX_class_attendance_section_date', ['organization_id', 'section_id', 'date'])
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
