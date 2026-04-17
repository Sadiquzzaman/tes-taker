import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExamEntity } from './exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { ExamQuestionEntity } from './exam-question.entity';

@Entity('exam_question_sections')
export class ExamQuestionSectionEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Parent exam UUID' })
  @Column({ name: 'exam_id', type: 'uuid' })
  exam_id: string;

  @ManyToOne(() => ExamEntity, (e) => e.questionSections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;

  @ApiProperty({ description: 'Subject this section belongs to' })
  @Column({ name: 'subject_id', type: 'uuid' })
  subject_id: string;

  @ManyToOne(() => SubjectEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @ApiProperty({ description: 'Section question style', enum: ['objective', 'essay'] })
  @Column({ name: 'section_type', type: 'varchar', length: 20 })
  section_type: string;

  @ApiPropertyOptional({ description: 'Optional heading shown above questions' })
  @Column({ name: 'header_text', type: 'text', nullable: true })
  header_text: string | null;

  @ApiProperty({ description: 'Order among sections for the same exam' })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @OneToMany(() => ExamQuestionEntity, (q) => q.section)
  questions: ExamQuestionEntity[];
}
