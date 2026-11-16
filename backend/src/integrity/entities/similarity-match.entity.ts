import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Span } from '../similarity';
import { SimilarityCheckEntity } from './similarity-check.entity';

export enum ReviewDecisionEnum {
  OK = 'OK',
  COPIED = 'COPIED',
}

/** Matching passages of a pair and how much of each text they are. */
export interface MatchSpans {
  a: Span[];
  b: Span[];
  a_percent: number;
  b_percent: number;
  /** IELTS Writing: the task. */
  part_no?: number;
}

/** A pair of similar submissions in a check, with the teacher's review (PLG-01, PLG-02). */
@Entity('similarity_matches')
@Index('IDX_similarity_matches_check', ['check_id', 'score'])
@Check('CHK_similarity_matches_decision', `"review_decision" IS NULL OR "review_decision" IN ('OK', 'COPIED')`)
export class SimilarityMatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'check_id', type: 'uuid' })
  check_id: string;

  @ManyToOne(() => SimilarityCheckEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'check_id', foreignKeyConstraintName: 'FK_similarity_matches_check' })
  check?: SimilarityCheckEntity;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  /** Homework submission or IELTS answer (script) ids. */
  @Column({ name: 'submission_a', type: 'uuid' })
  submission_a: string;

  @Column({ name: 'submission_b', type: 'uuid' })
  submission_b: string;

  @Column({ name: 'student_a', type: 'uuid' })
  student_a: string;

  @Column({ name: 'student_b', type: 'uuid' })
  student_b: string;

  /** The larger of the two shares, 0–100. */
  @Column({ name: 'score', type: 'numeric', precision: 5, scale: 2 })
  score: string;

  @Column({ name: 'spans', type: 'jsonb' })
  spans: MatchSpans;

  @Column({ name: 'review_decision', type: 'varchar', length: 10, nullable: true })
  review_decision: ReviewDecisionEnum | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  review_note: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;
}
