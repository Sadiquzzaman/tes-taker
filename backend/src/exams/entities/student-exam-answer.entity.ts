import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserEntity } from 'src/user/entities/user.entity';
import { ExamEntity } from './exam.entity';
import { ExamQuestionEntity, CorrectAnswerEnum } from './exam-question.entity';

export enum ExamSubmissionStatusEnum {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED', // When time expires
  DISQUALIFIED = 'DISQUALIFIED',
}

@Entity('student_exam_submissions')
@Unique(['student_id', 'exam_id'])
export class StudentExamSubmissionEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Student ID' })
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity;

  @ApiProperty({ description: 'Exam ID' })
  @Column({ name: 'exam_id', type: 'uuid' })
  exam_id: string;

  @ManyToOne(() => ExamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;

  @ApiProperty({ description: 'Submission status', enum: ExamSubmissionStatusEnum })
  @Column({ 
    name: 'status', 
    type: 'enum', 
    enum: ExamSubmissionStatusEnum, 
    default: ExamSubmissionStatusEnum.NOT_STARTED 
  })
  status: ExamSubmissionStatusEnum;

  @ApiPropertyOptional({ description: 'When the student started the exam' })
  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  started_at?: Date;

  @ApiPropertyOptional({ description: 'When the student submitted the exam' })
  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submitted_at?: Date;

  @ApiPropertyOptional({ description: 'Total score obtained' })
  @Column({ name: 'total_score', type: 'decimal', precision: 10, scale: 2, nullable: true })
  total_score?: number;

  @ApiPropertyOptional({ description: 'Maximum possible score' })
  @Column({ name: 'max_score', type: 'decimal', precision: 10, scale: 2, nullable: true })
  max_score?: number;

  @ApiPropertyOptional({ description: 'Number of correct answers (objective)' })
  @Column({ name: 'correct_answers', type: 'int', default: 0 })
  correct_answers: number;

  @ApiPropertyOptional({ description: 'Number of wrong answers (objective)' })
  @Column({ name: 'wrong_answers', type: 'int', default: 0 })
  wrong_answers: number;

  @ApiPropertyOptional({ description: 'Number of unanswered questions' })
  @Column({ name: 'unanswered', type: 'int', default: 0 })
  unanswered: number;

  @ApiPropertyOptional({ description: 'Total questions in exam' })
  @Column({ name: 'total_questions', type: 'int', default: 0 })
  total_questions: number;

  @ApiPropertyOptional({ description: 'Browser switch count (for tracking)' })
  @Column({ name: 'browser_switch_count', type: 'int', default: 0 })
  browser_switch_count: number;

  @ApiPropertyOptional({ description: 'Tab switch count (for tracking)' })
  @Column({ name: 'tab_switch_count', type: 'int', default: 0 })
  tab_switch_count: number;

  @ApiPropertyOptional({ description: 'IP address of submission' })
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ip_address?: string;

  @ApiPropertyOptional({ description: 'User agent string' })
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  user_agent?: string;
}

@Entity('student_exam_answers')
@Unique(['submission_id', 'question_id'])
export class StudentExamAnswerEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Submission ID' })
  @Column({ name: 'submission_id', type: 'uuid' })
  submission_id: string;

  @ManyToOne(() => StudentExamSubmissionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: StudentExamSubmissionEntity;

  @ApiProperty({ description: 'Question ID' })
  @Column({ name: 'question_id', type: 'uuid' })
  question_id: string;

  @ManyToOne(() => ExamQuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question: ExamQuestionEntity;

  // For objective questions
  @ApiPropertyOptional({ description: 'Selected answer for objective questions', enum: CorrectAnswerEnum })
  @Column({ name: 'selected_answer', type: 'enum', enum: CorrectAnswerEnum, nullable: true })
  selected_answer?: CorrectAnswerEnum;

  // For subjective questions
  @ApiPropertyOptional({ description: 'Text answer for subjective questions' })
  @Column({ name: 'text_answer', type: 'text', nullable: true })
  text_answer?: string;

  @ApiPropertyOptional({ description: 'Word count for subjective answers' })
  @Column({ name: 'word_count', type: 'int', nullable: true })
  word_count?: number;

  @ApiPropertyOptional({ description: 'Whether the answer is correct (for objective)' })
  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  is_correct?: boolean;

  @ApiPropertyOptional({ description: 'Marks obtained for this question' })
  @Column({ name: 'marks_obtained', type: 'decimal', precision: 10, scale: 2, nullable: true })
  marks_obtained?: number;

  @ApiPropertyOptional({ description: 'When the answer was last updated' })
  @Column({ name: 'answered_at', type: 'timestamp', nullable: true })
  answered_at?: Date;
}
