import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { UserEntity } from 'src/user/entities/user.entity';
// Type only: attendance-record.entity imports this file, so its enum may not be loaded yet here.
import type { AttendancePersonTypeEnum } from './attendance-record.entity';

const PERSON_TYPES = ['STUDENT', 'TEACHER'];

/**
 * Where a leave request stands (ATT-09, ATT-11). PENDING until an approver decides; CANCELLED when
 * the person, whoever applied for them or an approver withdraws it (never deleted).
 */
export enum LeaveStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * One leave request (design §9.4, table `leave_requests`): a student's or a teacher's whole days
 * off from `from_date` to `to_date` (school dates in the organisation's time zone; weekly off days
 * and holidays inside the range are simply not class days). Approved leave makes the closing job
 * save LEAVE instead of Absent, and turns Absent records already saved on those days into LEAVE
 * (with a correction row each). Rows are never deleted: withdrawing is status CANCELLED.
 */
@Entity('leave_requests')
@Index('IDX_leave_requests_person_from', ['organization_id', 'person_id', 'from_date'])
@Index('IDX_leave_requests_org_status', ['organization_id', 'status', 'from_date'])
@Check('CHK_leave_requests_dates', `"to_date" >= "from_date"`)
export class LeaveRequestEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty({ description: 'The student or teacher on leave' })
  @Column({ name: 'person_id', type: 'uuid' })
  person_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id', foreignKeyConstraintName: 'FK_leave_requests_person' })
  person?: UserEntity;

  @ApiProperty({ enum: PERSON_TYPES })
  @Column({ name: 'person_type', type: 'enum', enum: PERSON_TYPES, enumName: 'leave_person_type' })
  person_type: AttendancePersonTypeEnum;

  @ApiProperty({ example: '2026-11-08' })
  @Column({ name: 'from_date', type: 'date' })
  from_date: string;

  @ApiProperty({ example: '2026-11-10' })
  @Column({ name: 'to_date', type: 'date' })
  to_date: string;

  @ApiProperty()
  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @ApiPropertyOptional({ description: "An attachment, e.g. a doctor's note (file purpose LEAVE)" })
  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  file_id: string | null;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id', foreignKeyConstraintName: 'FK_leave_requests_file' })
  file?: FileObjectEntity | null;

  @ApiProperty({ enum: LeaveStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: LeaveStatusEnum, enumName: 'leave_status', default: LeaveStatusEnum.PENDING })
  status: LeaveStatusEnum;

  @ApiPropertyOptional({ description: 'Who applied: the person, or a teacher or admin for them' })
  @Column({ name: 'applied_by', type: 'uuid', nullable: true })
  applied_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'applied_by', foreignKeyConstraintName: 'FK_leave_requests_applied_by' })
  applicant?: UserEntity | null;

  @ApiPropertyOptional({ description: 'Who approved or rejected it' })
  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approver_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approver_id', foreignKeyConstraintName: 'FK_leave_requests_approver' })
  approver?: UserEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decided_at: Date | null;

  @ApiPropertyOptional({ description: "The approver's comment" })
  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decision_note: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelled_by', foreignKeyConstraintName: 'FK_leave_requests_cancelled_by' })
  canceller?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;
}
