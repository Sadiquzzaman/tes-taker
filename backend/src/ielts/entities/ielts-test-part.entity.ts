import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { IeltsModuleEnum } from './ielts-profile.entity';
import { IeltsTestEntity } from './ielts-test.entity';

/**
 * A part of an IELTS test: a Listening part (1–4, one recording), a Reading passage (1–3), a
 * Writing task (1–2) or a Speaking part (1–3).
 */
@Entity('ielts_test_parts')
@Index('UQ_ielts_test_parts_test_part', ['test_id', 'module', 'part_no'], { unique: true })
@Check(
  'CHK_ielts_test_parts_part_no',
  `("module" = 'LISTENING' AND "part_no" BETWEEN 1 AND 4) OR ("module" = 'READING' AND "part_no" BETWEEN 1 AND 3)
          OR ("module" = 'WRITING' AND "part_no" BETWEEN 1 AND 2) OR ("module" = 'SPEAKING' AND "part_no" BETWEEN 1 AND 3)`,
)
export class IeltsTestPartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_id', type: 'uuid' })
  test_id: string;

  @ManyToOne(() => IeltsTestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id', foreignKeyConstraintName: 'FK_ielts_test_parts_test' })
  test?: IeltsTestEntity;

  @Column({ name: 'module', type: 'varchar', length: 10 })
  module: IeltsModuleEnum;

  @Column({ name: 'part_no', type: 'smallint' })
  part_no: number;

  @Column({ name: 'title', type: 'varchar', length: 200, nullable: true })
  title: string | null;

  /** The Reading passage, the Writing task, or the Speaking questions / cue card. */
  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

  /** Listening: the part's one recording. */
  @Column({ name: 'audio_file_id', type: 'uuid', nullable: true })
  audio_file_id: string | null;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'audio_file_id', foreignKeyConstraintName: 'FK_ielts_test_parts_audio' })
  audio_file?: FileObjectEntity;

  /** Writing Task 1: the chart, map or diagram. */
  @Column({ name: 'image_file_id', type: 'uuid', nullable: true })
  image_file_id: string | null;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'image_file_id', foreignKeyConstraintName: 'FK_ielts_test_parts_image' })
  image_file?: FileObjectEntity;
}
