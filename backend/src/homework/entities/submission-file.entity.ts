import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import type { HomeworkSubmissionEntity } from './homework-submission.entity';

/** A file of a submission (HW-03): the student's upload (purpose HOMEWORK), in page order. */
@Entity('submission_files')
export class SubmissionFileEntity {
  @ApiProperty()
  @PrimaryColumn({ name: 'submission_id', type: 'uuid' })
  submission_id: string;

  @ManyToOne('HomeworkSubmissionEntity', 'files', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id', foreignKeyConstraintName: 'FK_submission_files_submission' })
  submission?: HomeworkSubmissionEntity;

  @ApiProperty()
  @PrimaryColumn({ name: 'file_id', type: 'uuid' })
  file_id: string;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id', foreignKeyConstraintName: 'FK_submission_files_file' })
  file?: FileObjectEntity;

  @ApiProperty()
  @Column({ name: 'page_order', type: 'smallint', default: 0 })
  page_order: number;
}
