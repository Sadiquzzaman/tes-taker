import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { AcademicSessionEntity } from './academic-session.entity';
import { SectionEntity } from './section.entity';
import { TermEntity } from './term.entity';

export enum OfferingEnrolmentModeEnum {
  /** Every active enrolment of the section. */
  WHOLE_SECTION = 'WHOLE_SECTION',
  /** Only the students in offering_enrolments (religion, electives). */
  SELECTED = 'SELECTED',
}

/**
 * A subject class (FND-19): section + subject + session, with an optional term. The core
 * teaching unit that attendance, homework, exams and marks link to.
 */
@Entity('course_offerings')
// One offering per section + subject for the whole session, and one per term when terms are used.
@Index('UQ_course_offerings_section_subject', ['section_id', 'subject_id'], { unique: true, where: '"term_id" IS NULL' })
@Index('UQ_course_offerings_section_subject_term', ['section_id', 'subject_id', 'term_id'], {
  unique: true,
  where: '"term_id" IS NOT NULL',
})
@Index(['organization_id', 'session_id'])
export class CourseOfferingEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: AcademicSessionEntity;

  @ApiPropertyOptional({ description: 'null = the whole session' })
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  term_id: string | null;

  @ManyToOne(() => TermEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'term_id' })
  term: TermEntity | null;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id' })
  section: SectionEntity;

  @ApiProperty()
  @Column({ name: 'subject_id', type: 'uuid' })
  subject_id: string;

  @ManyToOne(() => SubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @ApiProperty({ enum: OfferingEnrolmentModeEnum })
  @Column({
    name: 'enrolment_mode',
    type: 'enum',
    enum: OfferingEnrolmentModeEnum,
    default: OfferingEnrolmentModeEnum.WHOLE_SECTION,
  })
  enrolment_mode: OfferingEnrolmentModeEnum;

  @ApiProperty()
  @Column({ name: 'is_optional', type: 'boolean', default: false })
  is_optional: boolean;
}
