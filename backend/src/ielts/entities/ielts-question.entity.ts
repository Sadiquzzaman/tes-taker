import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IeltsOption, IeltsQuestionGroupEntity } from './ielts-question-group.entity';

/** The right answer: accepted spellings for a written answer, or the right keys for a choice. */
export type IeltsAnswerKey = { accepted: string[] } | { keys: string[] };

/** One question of a group; its number (1–40) is worked out from the order. Soft-deleted. */
@Entity('ielts_questions')
@Index('IDX_ielts_questions_group', ['group_id', 'sort_order'])
export class IeltsQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  group_id: string;

  @ManyToOne(() => IeltsQuestionGroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id', foreignKeyConstraintName: 'FK_ielts_questions_group' })
  group?: IeltsQuestionGroupEntity;

  @Column({ name: 'sort_order', type: 'smallint' })
  sort_order: number;

  @Column({ name: 'prompt', type: 'text', nullable: true })
  prompt: string | null;

  /** Multiple choice: the question's own options. */
  @Column({ name: 'options', type: 'jsonb', nullable: true })
  options: IeltsOption[] | null;

  @Column({ name: 'answer', type: 'jsonb' })
  answer: IeltsAnswerKey;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
