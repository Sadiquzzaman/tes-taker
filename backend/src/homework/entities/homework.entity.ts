import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { HomeworkAttachmentEntity } from './homework-attachment.entity';
import { HomeworkTargetEntity } from './homework-target.entity';

/** How students hand the homework in (HW-01). QUESTIONS (from the question bank) comes with Epic 4. */
export enum HomeworkTypeEnum {
  FILE = 'FILE',
  TEXT = 'TEXT',
  PAPER = 'PAPER',
}

/**
 * Where a homework stands: DRAFT (only staff see it), SCHEDULED (published by the homework job at
 * `publish_at`), PUBLISHED (students see it and were told), CANCELLED (withdrawn; kept, never deleted).
 */
export enum HomeworkStatusEnum {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
}

/**
 * One homework (HW-01, design §9.5): for one subject of one session, set to one or more of its
 * subject classes (`homework_targets`). Instructions are rich text (the editor's JSON). Rows are
 * never deleted: withdrawing a homework is status CANCELLED.
 */
@Entity('homework')
@Index('IDX_homework_org_status_due', ['organization_id', 'status', 'due_at'])
@Index('IDX_homework_org_session', ['organization_id', 'session_id'])
export class HomeworkEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_homework_session' })
  session?: AcademicSessionEntity;

  @ApiProperty()
  @Column({ name: 'subject_id', type: 'uuid' })
  subject_id: string;

  @ManyToOne(() => SubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_homework_subject' })
  subject?: SubjectEntity;

  @ApiProperty({ example: 'Chapter 3 exercise' })
  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @ApiPropertyOptional({ description: "Rich text (the editor's JSON)" })
  @Column({ name: 'instructions', type: 'jsonb', nullable: true })
  instructions: unknown;

  @ApiProperty({ enum: HomeworkTypeEnum })
  @Column({ name: 'submission_type', type: 'enum', enum: HomeworkTypeEnum, enumName: 'homework_type' })
  submission_type: HomeworkTypeEnum;

  @ApiPropertyOptional({ example: 10, description: 'Null = not scored' })
  @Column({ name: 'total_marks', type: 'numeric', precision: 6, scale: 2, nullable: true })
  total_marks: string | null;

  @ApiPropertyOptional({ description: 'When it is due; null = no due date' })
  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  due_at: Date | null;

  @ApiPropertyOptional({ description: 'When a SCHEDULED homework is published' })
  @Column({ name: 'publish_at', type: 'timestamptz', nullable: true })
  publish_at: Date | null;

  @ApiPropertyOptional({ description: 'When students were given it' })
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @ApiProperty({ enum: HomeworkStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: HomeworkStatusEnum, enumName: 'homework_status', default: HomeworkStatusEnum.DRAFT })
  status: HomeworkStatusEnum;

  @ApiPropertyOptional({ description: 'When the teacher published the scores; students see them from then on (HW-04)' })
  @Column({ name: 'scores_published_at', type: 'timestamptz', nullable: true })
  scores_published_at: Date | null;

  @ApiPropertyOptional({ description: 'When the 24-hour reminder went out (HW-02)' })
  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminder_sent_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @OneToMany(() => HomeworkTargetEntity, (target) => target.homework)
  targets?: HomeworkTargetEntity[];

  @OneToMany(() => HomeworkAttachmentEntity, (attachment) => attachment.homework)
  attachments?: HomeworkAttachmentEntity[];
}
