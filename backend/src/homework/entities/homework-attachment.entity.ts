import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import type { HomeworkEntity } from './homework.entity';

/** A teacher's file on a homework (HW-01): a stored file of purpose HOMEWORK, in the order added. */
@Entity('homework_attachments')
export class HomeworkAttachmentEntity {
  @ApiProperty()
  @PrimaryColumn({ name: 'homework_id', type: 'uuid' })
  homework_id: string;

  @ManyToOne('HomeworkEntity', 'attachments', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id', foreignKeyConstraintName: 'FK_homework_attachments_homework' })
  homework?: HomeworkEntity;

  @ApiProperty()
  @PrimaryColumn({ name: 'file_id', type: 'uuid' })
  file_id: string;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'file_id', foreignKeyConstraintName: 'FK_homework_attachments_file' })
  file?: FileObjectEntity;

  @ApiProperty()
  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sort_order: number;
}
