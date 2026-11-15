import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { IeltsTestPartEntity } from './ielts-test-part.entity';

/** A choice in a shared list (headings i–x, options A–H, a word box) or a question's own options. */
export interface IeltsOption {
  key: string;
  text: string;
}

/** What a group's questions share: a list to choose from and, for summaries and notes, the text with gaps. */
export interface IeltsGroupShared {
  options?: IeltsOption[];
  /** Summary, notes, table or flow-chart text with gaps marked [[1]], [[2]], … (the question's place in the group). */
  text?: string;
}

/**
 * A question group, the unit of the real paper (IEL-03): one instruction, the word limit, and a
 * shared list or a picture where the type needs one. Soft-deleted.
 */
@Entity('ielts_question_groups')
@Index('IDX_ielts_question_groups_part', ['part_id', 'sort_order'])
@Check('CHK_ielts_question_groups_word_limit', `"word_limit" IS NULL OR "word_limit" BETWEEN 1 AND 5`)
export class IeltsQuestionGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'part_id', type: 'uuid' })
  part_id: string;

  @ManyToOne(() => IeltsTestPartEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id', foreignKeyConstraintName: 'FK_ielts_question_groups_part' })
  part?: IeltsTestPartEntity;

  @Column({ name: 'type', type: 'varchar', length: 30 })
  type: string;

  @Column({ name: 'instruction', type: 'text' })
  instruction: string;

  /** e.g. 2 for "NO MORE THAN TWO WORDS"; numbers do not count. */
  @Column({ name: 'word_limit', type: 'smallint', nullable: true })
  word_limit: number | null;

  @Column({ name: 'shared', type: 'jsonb', nullable: true })
  shared: IeltsGroupShared | null;

  /** A map, plan or diagram. */
  @Column({ name: 'image_file_id', type: 'uuid', nullable: true })
  image_file_id: string | null;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_file_id', foreignKeyConstraintName: 'FK_ielts_question_groups_image' })
  image_file?: FileObjectEntity;

  @Column({ name: 'sort_order', type: 'smallint' })
  sort_order: number;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
