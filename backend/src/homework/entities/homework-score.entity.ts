import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { HomeworkSubmissionEntity } from './homework-submission.entity';
import { HomeworkEntity } from './homework.entity';

/** Optional 1–5 ratings for work on paper (HW-05), for the class-behaviour part of Epic 3. */
export interface HomeworkRatings {
  neatness?: number;
  effort?: number;
  on_time?: number;
}

/**
 * A student's score for a homework (HW-04, HW-05; design §9.5): the raw score out of the total, the
 * late penalty taken off (from the organisation's setting and how late the scored hand-in was) and
 * the final score, with feedback. One per homework and student; `is_missing` marks work never
 * handed in (final 0). Students see it once the teacher publishes the scores.
 */
@Entity('homework_scores')
@Index('UQ_homework_scores_student', ['homework_id', 'student_id'], { unique: true })
@Index('IDX_homework_scores_org', ['organization_id', 'homework_id'])
export class HomeworkScoreEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'homework_id', type: 'uuid' })
  homework_id: string;

  @ManyToOne(() => HomeworkEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id', foreignKeyConstraintName: 'FK_homework_scores_homework' })
  homework?: HomeworkEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_homework_scores_student' })
  student?: UserEntity;

  @ApiPropertyOptional({ description: 'The hand-in scored; null for paper homework or work never handed in' })
  @Column({ name: 'submission_id', type: 'uuid', nullable: true })
  submission_id: string | null;

  @ManyToOne(() => HomeworkSubmissionEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submission_id', foreignKeyConstraintName: 'FK_homework_scores_submission' })
  submission?: HomeworkSubmissionEntity | null;

  @ApiPropertyOptional({ example: 8 })
  @Column({ name: 'raw_score', type: 'numeric', precision: 6, scale: 2, nullable: true })
  raw_score: string | null;

  @ApiProperty({ example: 0.8, description: 'Marks taken off for lateness' })
  @Column({ name: 'penalty', type: 'numeric', precision: 6, scale: 2, default: 0 })
  penalty: string;

  @ApiPropertyOptional({ example: 7.2 })
  @Column({ name: 'final_score', type: 'numeric', precision: 6, scale: 2, nullable: true })
  final_score: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'feedback', type: 'text', nullable: true })
  feedback: string | null;

  @ApiPropertyOptional({ description: '{ neatness, effort, on_time } 1–5 (HW-05)' })
  @Column({ name: 'ratings', type: 'jsonb', nullable: true })
  ratings: HomeworkRatings | null;

  @ApiProperty()
  @Column({ name: 'is_missing', type: 'boolean', default: false })
  is_missing: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'scored_by', type: 'uuid', nullable: true })
  scored_by: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'scored_at', type: 'timestamptz', nullable: true })
  scored_at: Date | null;
}
