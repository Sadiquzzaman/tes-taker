import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { BranchEntity } from 'src/organizations/entities/branch.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { IeltsModuleEnum } from './ielts-profile.entity';

/**
 * An IELTS course (P12-04, IEL-13): what a centre or solo trainer sells (a branch, dates, one or more
 * modules). Underneath it is a class, its own session (the course's dates) and one section: the
 * students, timetable, attendance, homework, chat and IELTS openings all hang off the section.
 * Soft-deleted.
 */
@Entity('ielts_courses')
@Unique('UQ_ielts_courses_section', ['section_id'])
@Index('IDX_ielts_courses_org_branch', ['organization_id', 'branch_id'])
@Index('IDX_ielts_courses_org_dates', ['organization_id', 'start_date'])
@Check('CHK_ielts_courses_dates', `"end_date" >= "start_date"`)
@Check(
  'CHK_ielts_courses_modules',
  `cardinality("modules") BETWEEN 1 AND 4 AND "modules" <@ ARRAY['LISTENING','READING','WRITING','SPEAKING']::varchar[]`,
)
export class IeltsCourseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_courses_organization' })
  organization?: OrganizationEntity;

  /** Says what the course is ("Band 7 Academic — Jan 2027", "Writing crash course"); no course type. */
  @Column({ name: 'title', type: 'varchar', length: 150 })
  title: string;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branch_id: string | null;

  @ManyToOne(() => BranchEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'branch_id', foreignKeyConstraintName: 'FK_ielts_courses_branch' })
  branch?: BranchEntity | null;

  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_ielts_courses_class' })
  class?: ClassEntity;

  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_ielts_courses_session' })
  session?: AcademicSessionEntity;

  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_ielts_courses_section' })
  section?: SectionEntity;

  /** One or more modules, in test order; each is a subject class whose teachers teach it. */
  @Column({ name: 'modules', type: 'varchar', length: 10, array: true })
  modules: IeltsModuleEnum[];

  @Column({ name: 'start_date', type: 'date' })
  start_date: string;

  /** The course has ended once this day is over (in the organisation's time zone). */
  @Column({ name: 'end_date', type: 'date' })
  end_date: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
