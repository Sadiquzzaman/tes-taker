import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ExamEntity } from './exam.entity';
import { StudentExamSubmissionEntity } from './student-exam-answer.entity';

export enum AttemptReviewDecisionEnum {
  /** A disqualified attempt counts as submitted. */
  REINSTATE = 'REINSTATE',
  /** The attempt is opened again; the student starts it afresh inside the exam window (previous answers kept in the review). */
  RETAKE = 'RETAKE',
  /** The result stands. */
  CONFIRM = 'CONFIRM',
}

/** A teacher's decision on a disqualified or flagged attempt (P8-04, PRO-05). */
@Entity('exam_attempt_reviews')
@Index('IDX_exam_attempt_reviews_exam_student', ['exam_id', 'student_id', 'decided_at'])
@Check('CHK_exam_attempt_reviews_decision', `"decision" IN ('REINSTATE', 'RETAKE', 'CONFIRM')`)
export class ExamAttemptReviewEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ApiProperty()
  @Column({ name: 'exam_id', type: 'uuid' })
  exam_id: string;

  @ManyToOne(() => ExamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id', foreignKeyConstraintName: 'FK_exam_attempt_reviews_exam' })
  exam?: ExamEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_exam_attempt_reviews_student' })
  student?: UserEntity;

  @Column({ name: 'submission_id', type: 'uuid' })
  submission_id: string;

  @ManyToOne(() => StudentExamSubmissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id', foreignKeyConstraintName: 'FK_exam_attempt_reviews_submission' })
  submission?: StudentExamSubmissionEntity;

  @ApiProperty({ enum: AttemptReviewDecisionEnum })
  @Column({ name: 'decision', type: 'varchar', length: 10 })
  decision: AttemptReviewDecisionEnum;

  @ApiProperty()
  @Column({ name: 'reason', type: 'varchar', length: 500 })
  reason: string;

  @ApiProperty()
  @Column({ name: 'previous_status', type: 'varchar', length: 20 })
  previous_status: string;

  @ApiPropertyOptional()
  @Column({ name: 'previous_score', type: 'numeric', precision: 10, scale: 2, nullable: true })
  previous_score: string | null;

  /** For a retake: the answers and score before it was opened again. */
  @Column({ name: 'previous_attempt', type: 'jsonb', nullable: true })
  previous_attempt: Record<string, unknown> | null;

  @Column({ name: 'decided_by', type: 'uuid' })
  decided_by: string;

  @ApiProperty()
  @Column({ name: 'decided_at', type: 'timestamptz', default: () => 'now()' })
  decided_at: Date;
}
