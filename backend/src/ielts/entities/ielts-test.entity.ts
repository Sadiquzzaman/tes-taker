import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './ielts-profile.entity';

export enum IeltsTestPurposeEnum {
  /** The real template: every part of each module included. */
  MOCK = 'MOCK',
  /** Any part, passage or task of one module. */
  PRACTICE = 'PRACTICE',
}

export enum IeltsTestStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** An IELTS test in the computer-delivered format (IEL-03): a mock or a practice set. Soft-deleted. */
@Entity('ielts_tests')
@Index('IDX_ielts_tests_organization', ['organization_id', 'status'])
@Check('CHK_ielts_tests_test_type', `"test_type" IN ('ACADEMIC', 'GENERAL')`)
@Check('CHK_ielts_tests_purpose', `"purpose" IN ('MOCK', 'PRACTICE')`)
@Check('CHK_ielts_tests_status', `"status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`)
export class IeltsTestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_tests_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'test_type', type: 'varchar', length: 10 })
  test_type: IeltsTestTypeEnum;

  @Column({ name: 'purpose', type: 'varchar', length: 10 })
  purpose: IeltsTestPurposeEnum;

  /** The modules included, in test order, e.g. ["LISTENING", "READING", "WRITING", "SPEAKING"]. */
  @Column({ name: 'modules', type: 'jsonb' })
  modules: IeltsModuleEnum[];

  /** Seconds per module (Listening's 2 minutes to check answers come on top). */
  @Column({ name: 'durations', type: 'jsonb' })
  durations: Partial<Record<IeltsModuleEnum, number>>;

  @Column({ name: 'status', type: 'varchar', length: 10, default: IeltsTestStatusEnum.DRAFT })
  status: IeltsTestStatusEnum;

  /** Copied from this academic-builder IELTS exam (P10-08). */
  @Column({ name: 'source_exam_id', type: 'uuid', nullable: true })
  source_exam_id: string | null;

  @ManyToOne(() => ExamEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_exam_id', foreignKeyConstraintName: 'FK_ielts_tests_source_exam' })
  source_exam?: ExamEntity;

  /** A copied test someone should check before use. */
  @Column({ name: 'needs_review', type: 'boolean', default: false })
  needs_review: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  created_by: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_ielts_tests_created_by' })
  creator?: UserEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
