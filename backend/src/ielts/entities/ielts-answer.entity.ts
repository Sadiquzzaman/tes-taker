import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IeltsAttemptEntity } from './ielts-attempt.entity';
import { IeltsQuestionEntity } from './ielts-question.entity';
import { IeltsTestPartEntity } from './ielts-test-part.entity';

/** A student's answer to one question (or a Writing task's script) with its marks. */
@Entity('ielts_answers')
@Index('UQ_ielts_answers_question', ['attempt_id', 'question_id'], { unique: true, where: '"question_id" IS NOT NULL' })
@Index('UQ_ielts_answers_part', ['attempt_id', 'part_id'], { unique: true, where: '"question_id" IS NULL' })
export class IeltsAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attempt_id: string;

  @ManyToOne(() => IeltsAttemptEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id', foreignKeyConstraintName: 'FK_ielts_answers_attempt' })
  attempt?: IeltsAttemptEntity;

  /** Null for a Writing task's script (the answer of its part). */
  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  question_id: string | null;

  @ManyToOne(() => IeltsQuestionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id', foreignKeyConstraintName: 'FK_ielts_answers_question' })
  question?: IeltsQuestionEntity;

  @Column({ name: 'part_id', type: 'uuid' })
  part_id: string;

  @ManyToOne(() => IeltsTestPartEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id', foreignKeyConstraintName: 'FK_ielts_answers_part' })
  part?: IeltsTestPartEntity;

  /** The text written, or the chosen key(s) ("B" or "B,D"). */
  @Column({ name: 'answer', type: 'text', nullable: true })
  answer: string | null;

  /** Set when scored. */
  @Column({ name: 'correct', type: 'boolean', nullable: true })
  correct: boolean | null;

  /** "Choose TWO letters" can give 2. */
  @Column({ name: 'marks', type: 'smallint', default: 0 })
  marks: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}
