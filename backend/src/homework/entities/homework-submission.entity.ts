import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { HomeworkEntity } from './homework.entity';
import { SubmissionFileEntity } from './submission-file.entity';

/**
 * Where a submission stands (HW-03, HW-04): SUBMITTED until the teacher scores it (SCORED) or hands
 * it back for redo (RETURNED, which allows one more submission even past the limit).
 */
export enum SubmissionStatusEnum {
  SUBMITTED = 'SUBMITTED',
  RETURNED = 'RETURNED',
  SCORED = 'SCORED',
}

/**
 * One hand-in of a homework by a student (HW-03, design §9.5). Each new hand-in is a new version;
 * earlier versions are kept for the teacher. After the due time it is marked late, with how late.
 */
@Entity('homework_submissions')
@Index('UQ_homework_submissions_version', ['homework_id', 'student_id', 'version'], { unique: true })
@Index('IDX_homework_submissions_org', ['organization_id', 'homework_id'])
export class HomeworkSubmissionEntity {
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
  @JoinColumn({ name: 'homework_id', foreignKeyConstraintName: 'FK_homework_submissions_homework' })
  homework?: HomeworkEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_homework_submissions_student' })
  student?: UserEntity;

  @ApiProperty({ example: 1 })
  @Column({ name: 'version', type: 'smallint', default: 1 })
  version: number;

  @ApiPropertyOptional({ description: 'A typed answer (TEXT homework, or a note with files)' })
  @Column({ name: 'text_answer', type: 'text', nullable: true })
  text_answer: string | null;

  @ApiProperty()
  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submitted_at: Date;

  @ApiProperty()
  @Column({ name: 'is_late', type: 'boolean', default: false })
  is_late: boolean;

  @ApiPropertyOptional({ description: 'Minutes after the due time' })
  @Column({ name: 'late_minutes', type: 'integer', nullable: true })
  late_minutes: number | null;

  @ApiProperty({ enum: SubmissionStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: SubmissionStatusEnum, enumName: 'submission_status', default: SubmissionStatusEnum.SUBMITTED })
  status: SubmissionStatusEnum;

  @OneToMany(() => SubmissionFileEntity, (file) => file.submission)
  files?: SubmissionFileEntity[];
}
