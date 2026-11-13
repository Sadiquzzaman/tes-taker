import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ExamEntity } from './exam.entity';

export enum ProctoringEventSourceEnum {
  /** Sent by the student's browser during the exam. */
  LIVE = 'LIVE',
  /** Sent with the final submit (flags the live channel missed). */
  SUBMIT = 'SUBMIT',
  /** Noticed by the server, e.g. monitoring lost (PRO-07). */
  SERVER = 'SERVER',
}

/** One proctoring flag or event of a student in an exam (P8-02, PRO-07). */
@Entity('proctoring_events')
@Index('IDX_proctoring_events_exam_student', ['exam_id', 'student_id', 'occurred_at'])
@Index('UQ_proctoring_events_client', ['exam_id', 'student_id', 'client_id'], { unique: true, where: '"client_id" IS NOT NULL' })
@Check('CHK_proctoring_events_source', `"source" IN ('LIVE', 'SUBMIT', 'SERVER')`)
export class ProctoringEventEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ApiProperty()
  @Column({ name: 'exam_id', type: 'uuid' })
  exam_id: string;

  @ManyToOne(() => ExamEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id', foreignKeyConstraintName: 'FK_proctoring_events_exam' })
  exam?: ExamEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_proctoring_events_student' })
  student?: UserEntity;

  /** The browser's id for the flag, so it is stored once whether it came live or with the submit. */
  @Column({ name: 'client_id', type: 'varchar', length: 64, nullable: true })
  client_id: string | null;

  @ApiProperty({ example: 'tab-switch' })
  @Column({ name: 'type', type: 'varchar', length: 40 })
  type: string;

  @ApiPropertyOptional({ example: 'proctoring_tab_switch', description: 'The check (plan feature key) it belongs to' })
  @Column({ name: 'check_key', type: 'varchar', length: 60, nullable: true })
  check_key: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'message', type: 'varchar', length: 300, nullable: true })
  message: string | null;

  @ApiProperty()
  @Column({ name: 'points', type: 'smallint', default: 0 })
  points: number;

  @ApiProperty({ enum: ProctoringEventSourceEnum })
  @Column({ name: 'source', type: 'varchar', length: 10 })
  source: ProctoringEventSourceEnum;

  @ApiProperty()
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurred_at: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
