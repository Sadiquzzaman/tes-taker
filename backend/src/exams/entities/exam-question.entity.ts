import { IsNotEmpty, IsString, MaxLength, IsEnum } from 'class-validator';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ExamEntity } from './exam.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CorrectAnswerEnum {
  OPTION_1 = 'Option 1',
  OPTION_2 = 'Option 2',
  OPTION_3 = 'Option 3',
  OPTION_4 = 'Option 4',
}

export enum QuestionTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

@Entity('exam_questions')
export class ExamQuestionEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Type of question', enum: QuestionTypeEnum })
  @Column({ type: 'enum', enum: QuestionTypeEnum, default: QuestionTypeEnum.OBJECTIVE })
  question_type: QuestionTypeEnum;

  @ApiProperty({ description: 'The question text' })
  @Column({ type: 'text' })
  @IsNotEmpty()
  @IsString()
  question: string;

  // Objective question fields
  @ApiPropertyOptional({ description: 'First option (for objective questions)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  option1?: string;

  @ApiPropertyOptional({ description: 'Second option (for objective questions)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  option2?: string;

  @ApiPropertyOptional({ description: 'Third option (for objective questions)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  option3?: string;

  @ApiPropertyOptional({ description: 'Fourth option (for objective questions)' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  option4?: string;

  @ApiPropertyOptional({ description: 'Correct answer (for objective questions)', enum: CorrectAnswerEnum })
  @Column({ type: 'enum', enum: CorrectAnswerEnum, nullable: true })
  correct_answer?: CorrectAnswerEnum;

  @ApiPropertyOptional({ description: 'Explanation for the answer' })
  @Column({ type: 'text', nullable: true })
  explanation?: string;

  // Subjective question fields
  @ApiPropertyOptional({ description: 'Expected word limit for the answer (for subjective questions)' })
  @Column({ type: 'int', nullable: true })
  expected_word_limit?: number;

  @ApiPropertyOptional({ description: 'Marks per question (for subjective questions)' })
  @Column({ type: 'float', nullable: true })
  marks_per_question?: number;

  @ApiPropertyOptional({ description: 'Sample answer (for subjective questions)' })
  @Column({ type: 'text', nullable: true })
  sample_answer?: string;

  // Link to parent Exam
  @ManyToOne(() => ExamEntity, (exam) => exam.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam: ExamEntity;
}
