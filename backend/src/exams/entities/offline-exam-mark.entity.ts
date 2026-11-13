import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { OfflineExamEntity } from './offline-exam.entity';

/**
 * A student's marks in a paper exam (PRF-03): the total (or the parts, summed), or absent. One per
 * exam and student; changes are kept in the audit log.
 */
@Entity('offline_exam_marks')
@Index('UQ_offline_exam_marks_student', ['offline_exam_id', 'student_id'], { unique: true })
@Index('IDX_offline_exam_marks_org_student', ['organization_id', 'student_id'])
@Check('CHK_offline_exam_marks_marks', '"marks" IS NULL OR "marks" >= 0')
export class OfflineExamMarkEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'offline_exam_id', type: 'uuid' })
  offline_exam_id: string;

  @ManyToOne(() => OfflineExamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offline_exam_id', foreignKeyConstraintName: 'FK_offline_exam_marks_exam' })
  exam?: OfflineExamEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_offline_exam_marks_student' })
  student?: UserEntity;

  @ApiPropertyOptional({ example: 72.5 })
  @Column({ name: 'marks', type: 'numeric', precision: 6, scale: 2, nullable: true })
  marks: string | null;

  @ApiPropertyOptional({ description: 'Marks per part, by part name' })
  @Column({ name: 'part_marks', type: 'jsonb', nullable: true })
  part_marks: Record<string, number> | null;

  @ApiProperty()
  @Column({ name: 'is_absent', type: 'boolean', default: false })
  is_absent: boolean;

  @Column({ name: 'entered_by', type: 'uuid', nullable: true })
  entered_by: string | null;

  @Column({ name: 'entered_at', type: 'timestamptz', nullable: true })
  entered_at: Date | null;
}
