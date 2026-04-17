import {
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { ExamQuestionEntity } from './exam-question.entity';
import { ExamQuestionSectionEntity } from './exam-question-section.entity';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamKindEnum, PublishTimingEnum, TestAudienceEnum } from '../enums/exam-wizard.enums';

export enum ExamTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

@Entity({ name: 'exams' })
export class ExamEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Legacy coarse type (OBJECTIVE / SUBJECTIVE)', enum: ExamTypeEnum })
  @Column({ name: 'exam_type', type: 'enum', enum: ExamTypeEnum, default: ExamTypeEnum.OBJECTIVE })
  exam_type: ExamTypeEnum;

  @ApiPropertyOptional({
    description: 'Wizard exam kind: mcq | essay | hybrid | model',
    enum: ExamKindEnum,
  })
  @Column({ name: 'exam_kind', type: 'varchar', length: 20, nullable: true })
  exam_kind: ExamKindEnum | null;

  @ApiPropertyOptional({ description: 'Display title for the test' })
  @Column({ name: 'test_name', type: 'varchar', length: 200, nullable: true })
  test_name: string | null;

  @ApiPropertyOptional({ description: 'Primary subject for mcq, essay, hybrid (null for model tests)' })
  @Column({ name: 'primary_subject_id', type: 'uuid', nullable: true })
  primary_subject_id: string | null;

  @ManyToOne(() => SubjectEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_subject_id' })
  primary_subject: SubjectEntity | null;

  @ApiPropertyOptional({ description: 'Duration shown in the builder (minutes)' })
  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  duration_minutes: number | null;

  @ApiPropertyOptional({ description: 'Minimum score to pass' })
  @Column({ name: 'passing_score', type: 'float', nullable: true })
  passing_score: number | null;

  @ApiPropertyOptional({ description: 'When publish_timing is later', enum: PublishTimingEnum })
  @Column({ name: 'publish_timing', type: 'varchar', length: 20, nullable: true })
  publish_timing: PublishTimingEnum | null;

  @ApiPropertyOptional({ description: 'Who may take the exam', enum: TestAudienceEnum })
  @Column({ name: 'test_audience', type: 'varchar', length: 30, nullable: true })
  test_audience: TestAudienceEnum | null;

  @ApiPropertyOptional({ description: 'Invite token when test_audience is anyone' })
  @Column({ name: 'invite_token', type: 'varchar', length: 100, nullable: true, unique: true })
  @Index()
  invite_token: string | null;

  @ApiProperty({ description: 'Exam start time' })
  @Column({ name: 'exam_start_time', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  exam_start_time: Date;

  @ApiProperty({ description: 'Exam end time' })
  @Column({ name: 'exam_end_time', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  exam_end_time: Date;

  @ApiPropertyOptional({ description: 'Whether negative marking is enabled for objective items' })
  @Column({ name: 'is_negative_marking', type: 'boolean', default: false })
  is_negative_marking: boolean;

  @ApiPropertyOptional({ description: 'Penalty applied per wrong objective answer (flat or fraction of question points)' })
  @Column({ name: 'negative_mark_value', type: 'float', nullable: true })
  negative_mark_value: number | null;

  @ApiPropertyOptional({ description: 'Deprecated: use test_name + subjects. Kept for legacy rows.' })
  @Column({ name: 'subject', type: 'varchar', length: 100, nullable: true })
  subject: string | null;

  @ApiPropertyOptional({ description: 'Class ID when audience is selected_class' })
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  class_id: string | null;

  @ManyToOne(() => ClassEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiPropertyOptional({ description: 'Students excluded when using a class audience' })
  @ManyToMany(() => UserEntity)
  @JoinTable({
    name: 'exam_excluded_students',
    joinColumn: { name: 'exam_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'student_id', referencedColumnName: 'id' },
  })
  excluded_students: UserEntity[];

  @ApiPropertyOptional({ description: 'Allowed students when test_audience is specific_students' })
  @ManyToMany(() => UserEntity)
  @JoinTable({
    name: 'exam_target_students',
    joinColumn: { name: 'exam_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'student_id', referencedColumnName: 'id' },
  })
  target_students: UserEntity[];

  @OneToMany(() => ExamQuestionSectionEntity, (s) => s.exam, { cascade: true })
  questionSections: ExamQuestionSectionEntity[];

  @OneToMany(() => ExamQuestionEntity, (question) => question.exam, {
    cascade: true,
  })
  questions: ExamQuestionEntity[];
}
