import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { IeltsAssignmentEntity } from './ielts-assignment.entity';
import { IeltsModuleEnum } from './ielts-profile.entity';
import { IeltsTestEntity } from './ielts-test.entity';

export enum IeltsAttemptStatusEnum {
  IN_PROGRESS = 'IN_PROGRESS',
  /** Handed in; Writing and Speaking wait for marking. */
  SUBMITTED = 'SUBMITTED',
  /** Has its band. */
  MARKED = 'MARKED',
}

/** A student's attempt at one module of an assigned IELTS test (IEL-04–08): timer, score and band. */
@Entity('ielts_attempts')
@Index('UQ_ielts_attempts_assignment_student_module', ['assignment_id', 'student_id', 'module'], { unique: true })
@Index('IDX_ielts_attempts_test_student', ['test_id', 'student_id', 'module'])
@Check('CHK_ielts_attempts_module', `"module" IN ('LISTENING', 'READING', 'WRITING', 'SPEAKING')`)
@Check('CHK_ielts_attempts_status', `"status" IN ('IN_PROGRESS', 'SUBMITTED', 'MARKED')`)
@Check('CHK_ielts_attempts_mode', `"mode" IS NULL OR "mode" IN ('LIVE', 'RECORDED')`)
@Check('CHK_ielts_attempts_band', `"band" IS NULL OR ("band" >= 0 AND "band" <= 9)`)
@Check('CHK_ielts_attempts_raw', `"raw_score" IS NULL OR ("raw_score" >= 0 AND "raw_score" <= 40)`)
export class IeltsAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_attempts_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'test_id', type: 'uuid' })
  test_id: string;

  @ManyToOne(() => IeltsTestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id', foreignKeyConstraintName: 'FK_ielts_attempts_test' })
  test?: IeltsTestEntity;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignment_id: string;

  @ManyToOne(() => IeltsAssignmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id', foreignKeyConstraintName: 'FK_ielts_attempts_assignment' })
  assignment?: IeltsAssignmentEntity;

  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_ielts_attempts_student' })
  student?: UserEntity;

  @Column({ name: 'module', type: 'varchar', length: 10 })
  module: IeltsModuleEnum;

  /** Speaking: LIVE (a session with the examiner) or RECORDED (the student's practice recordings). */
  @Column({ name: 'mode', type: 'varchar', length: 10, nullable: true })
  mode: string | null;

  @Column({ name: 'status', type: 'varchar', length: 15, default: IeltsAttemptStatusEnum.IN_PROGRESS })
  status: IeltsAttemptStatusEnum;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  started_at: Date;

  /** When the module's time runs out (Listening includes its 2 minutes to check answers). */
  @Column({ name: 'deadline', type: 'timestamptz' })
  deadline: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submitted_at: Date | null;

  /** Listening / Reading: out of 40. */
  @Column({ name: 'raw_score', type: 'smallint', nullable: true })
  raw_score: number | null;

  @Column({ name: 'band', type: 'numeric', precision: 2, scale: 1, nullable: true })
  band: string | null;

  /** Writing per task (TA/TR, CC, LR, GRA) and Speaking (FC, LR, GRA, P), from P10-05/06. */
  @Column({ name: 'criteria', type: 'jsonb', nullable: true })
  criteria: Record<string, unknown> | null;

  @Column({ name: 'feedback', type: 'text', nullable: true })
  feedback: string | null;

  /** Speaking: the recording of each part, part id → file id. */
  @Column({ name: 'recording_file_ids', type: 'jsonb', nullable: true })
  recording_file_ids: Record<string, string> | null;

  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  marked_by: string | null;

  @Column({ name: 'marked_at', type: 'timestamptz', nullable: true })
  marked_at: Date | null;
}
