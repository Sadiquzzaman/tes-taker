import { IsNotEmpty, IsString } from 'class-validator';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ExamEntity } from './exam.entity';
import { ExamQuestionSectionEntity } from './exam-question-section.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionCategoryEnum } from '../enums/question.enums';

export type StoredQuestionOption = { id: string; text: string };
export type StoredMatchingOptions = {
  left: StoredQuestionOption[];
  right: StoredQuestionOption[];
};
export type StoredQuestionAnswer = { type: string; value: string[] };

export enum CorrectAnswerEnum {
  OPTION_1 = 'Option 1',
  OPTION_2 = 'Option 2',
  OPTION_3 = 'Option 3',
  OPTION_4 = 'Option 4',
  OPTION_5 = 'Option 5',
}

/** Index 0..4 maps to option1..option5 and selected_answer enum */
export const CORRECT_ANSWER_ENUM_BY_OPTION_INDEX: CorrectAnswerEnum[] = [
  CorrectAnswerEnum.OPTION_1,
  CorrectAnswerEnum.OPTION_2,
  CorrectAnswerEnum.OPTION_3,
  CorrectAnswerEnum.OPTION_4,
  CorrectAnswerEnum.OPTION_5,
];

export enum QuestionTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

@Entity('exam_questions')
export class ExamQuestionEntity extends CustomBaseEntity {
  @ApiPropertyOptional({ description: 'Optional section grouping (wizard exams)' })
  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  section_id: string | null;

  @ManyToOne(() => ExamQuestionSectionEntity, (s) => s.questions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: ExamQuestionSectionEntity | null;

  @ApiProperty({ description: 'Order within section or legacy exam', default: 0 })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @ApiProperty({ description: 'Legacy auto/manual bucket (OBJECTIVE | SUBJECTIVE)' })
  @Column({ type: 'enum', enum: QuestionTypeEnum, default: QuestionTypeEnum.OBJECTIVE })
  question_type: QuestionTypeEnum;

  @ApiPropertyOptional({
    description: 'Builder category: graded | ungraded | passage-question',
    enum: QuestionCategoryEnum,
  })
  @Column({ name: 'category', type: 'varchar', length: 30, nullable: true })
  category: QuestionCategoryEnum | null;

  @ApiPropertyOptional({ description: 'Builder sub-type e.g. multiple-choice, essay' })
  @Column({ name: 'sub_type', type: 'varchar', length: 40, nullable: true })
  sub_type: string | null;

  @ApiPropertyOptional({ description: 'Parent passage question id for passage child rows' })
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => ExamQuestionEntity, (q) => q.childQuestions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ExamQuestionEntity | null;

  @OneToMany(() => ExamQuestionEntity, (q) => q.parent)
  childQuestions: ExamQuestionEntity[];

  @ApiPropertyOptional({ description: 'Reading passage body (passage parent only)' })
  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passage_text: string | null;

  @ApiPropertyOptional({ description: 'Options with stable client ids' })
  @Column({ name: 'options_json', type: 'jsonb', nullable: true })
  options_json: StoredQuestionOption[] | null;

  @ApiPropertyOptional({ description: 'Left/right columns for matching-ordering' })
  @Column({ name: 'matching_options_json', type: 'jsonb', nullable: true })
  matching_options_json: StoredMatchingOptions | null;

  @ApiPropertyOptional({ description: 'Correct answer payload from builder' })
  @Column({ name: 'answer_json', type: 'jsonb', nullable: true })
  answer_json: StoredQuestionAnswer | null;

  @ApiProperty({ description: 'The question text' })
  @Column({ type: 'text' })
  @IsNotEmpty()
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: 'Optional image URL for the question' })
  @Column({ name: 'image_url', type: 'varchar', length: 2048, nullable: true })
  image_url: string | null;

  @ApiPropertyOptional({ description: 'Marks for this question (MCQ and essay)' })
  @Column({ name: 'points', type: 'float', nullable: true })
  points: number | null;

  @ApiPropertyOptional({ description: 'Per-question instructions (max 500 chars)' })
  @Column({ name: 'instruction', type: 'varchar', length: 500, nullable: true })
  instruction: string | null;

  @ApiPropertyOptional({ description: '0-based index of correct option for objective questions' })
  @Column({ name: 'correct_option_index', type: 'int', nullable: true })
  correct_option_index: number | null;

  @ApiPropertyOptional({ description: 'First option (objective)' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  option1?: string;

  @ApiPropertyOptional({ description: 'Second option (objective)' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  option2?: string;

  @ApiPropertyOptional({ description: 'Third option (objective)' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  option3?: string;

  @ApiPropertyOptional({ description: 'Fourth option (objective)' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  option4?: string;

  @ApiPropertyOptional({ description: 'Fifth option (objective, optional)' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  option5?: string | null;

  @ApiPropertyOptional({ description: 'Correct answer (objective), derived from correct_option_index', enum: CorrectAnswerEnum })
  @Column({ type: 'enum', enum: CorrectAnswerEnum, nullable: true })
  correct_answer?: CorrectAnswerEnum;

  @ApiPropertyOptional({ description: 'Explanation for the answer' })
  @Column({ type: 'text', nullable: true })
  explanation?: string;

  @ApiPropertyOptional({ description: 'Expected word limit (subjective)' })
  @Column({ type: 'int', nullable: true })
  expected_word_limit?: number;

  @ApiPropertyOptional({ description: 'Marks per question (legacy subjective; prefer points)' })
  @Column({ type: 'float', nullable: true })
  marks_per_question?: number;

  @ApiPropertyOptional({ description: 'Sample answer (subjective)' })
  @Column({ type: 'text', nullable: true })
  sample_answer?: string;

  @ManyToOne(() => ExamEntity, (exam) => exam.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;
}
