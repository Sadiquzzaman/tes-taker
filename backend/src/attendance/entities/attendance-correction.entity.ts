import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { AttendanceRecordEntity, AttendanceStatusEnum } from './attendance-record.entity';

/**
 * One correction of an attendance record (ATT-12): the old and new status, the reason, who made it
 * and when. Rows are only added. `correction_sms_sent` is for P3-04 (a correction SMS after an
 * absence SMS).
 */
@Entity('attendance_corrections')
@Index('IDX_attendance_corrections_record', ['record_id', 'created_at'])
export class AttendanceCorrectionEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'record_id', type: 'uuid' })
  record_id: string;

  @ManyToOne(() => AttendanceRecordEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id', foreignKeyConstraintName: 'FK_attendance_corrections_record' })
  record?: AttendanceRecordEntity;

  @ApiPropertyOptional({ enum: AttendanceStatusEnum, description: 'null when there was no record yet (nobody checked in)' })
  @Column({ name: 'old_status', type: 'enum', enum: AttendanceStatusEnum, enumName: 'attendance_status', nullable: true })
  old_status: AttendanceStatusEnum | null;

  @ApiProperty({ enum: AttendanceStatusEnum })
  @Column({ name: 'new_status', type: 'enum', enum: AttendanceStatusEnum, enumName: 'attendance_status' })
  new_status: AttendanceStatusEnum;

  @ApiProperty()
  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @ApiPropertyOptional()
  @Column({ name: 'corrected_by', type: 'uuid', nullable: true })
  corrected_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'corrected_by', foreignKeyConstraintName: 'FK_attendance_corrections_corrected_by' })
  corrector?: UserEntity | null;

  @ApiProperty()
  @Column({ name: 'correction_sms_sent', type: 'boolean', default: false })
  correction_sms_sent: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
