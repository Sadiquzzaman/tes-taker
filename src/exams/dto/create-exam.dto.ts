import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateObjectiveQuestionDto, CreateSubjectiveQuestionDto } from "./create-exam-question.dto";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ExamTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

export class CreateObjectiveExamDto {
  @ApiProperty({ 
    description: 'Type of exam',
    enum: ExamTypeEnum, 
    default: ExamTypeEnum.OBJECTIVE 
  })
  @IsEnum(ExamTypeEnum)
  exam_type: ExamTypeEnum = ExamTypeEnum.OBJECTIVE;

  @ApiProperty({ 
    description: 'Exam start time',
    example: new Date().toISOString() 
  })
  @IsDate({ message: 'Exam start time must be a valid Date' })
  @IsNotEmpty()
  @Type(() => Date)
  exam_start_time: Date;

  @ApiProperty({ 
    description: 'Exam end time',
    example: new Date(Date.now() + 3600000).toISOString() 
  })
  @IsDate({ message: 'Exam end time must be a valid Date' })
  @IsNotEmpty()
  @Type(() => Date)
  exam_end_time: Date;

  @ApiProperty({ 
    description: 'Whether negative marking is enabled',
    example: true 
  })
  @IsBoolean({ message: "is_negative_marking must be true or false" })
  is_negative_marking: boolean;

  @ApiPropertyOptional({ 
    description: 'Negative mark value per wrong answer (required if negative marking is enabled)',
    example: 0.25 
  })
  @IsOptional()
  @IsNumber({}, { message: "Negative mark value must be a number" })
  @Min(0, { message: "Negative mark value must be greater than or equal to 0" })
  negative_mark_value?: number;

  @ApiProperty({ 
    description: 'Subject of the exam',
    example: "Mathematics" 
  })
  @IsNotEmpty({ message: "Subject must be provided" })
  @IsString({ message: "Subject must be a string" })
  @MaxLength(100, { message: "Subject can be maximum 100 characters" })
  subject: string;

  @ApiPropertyOptional({ 
    description: 'Class ID to assign this exam to',
    example: 'uuid-class-id' 
  })
  @IsOptional()
  @IsUUID('4', { message: 'Class ID must be a valid UUID' })
  class_id?: string;

  @ApiPropertyOptional({ 
    description: 'Array of student IDs to exclude from this exam',
    type: [String],
    example: ['uuid-student-1', 'uuid-student-2'] 
  })
  @IsOptional()
  @IsArray({ message: 'Excluded student IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each excluded student ID must be a valid UUID' })
  excluded_student_ids?: string[];

  @ApiProperty({
    description: "List of objective questions for the exam",
    type: [CreateObjectiveQuestionDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one question is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateObjectiveQuestionDto)
  questions: CreateObjectiveQuestionDto[];
}

export class CreateSubjectiveExamDto {
  @ApiProperty({ 
    description: 'Type of exam',
    enum: ExamTypeEnum, 
    default: ExamTypeEnum.SUBJECTIVE 
  })
  @IsEnum(ExamTypeEnum)
  exam_type: ExamTypeEnum = ExamTypeEnum.SUBJECTIVE;

  @ApiProperty({ 
    description: 'Exam start time',
    example: new Date().toISOString() 
  })
  @IsDate({ message: 'Exam start time must be a valid Date' })
  @IsNotEmpty()
  @Type(() => Date)
  exam_start_time: Date;

  @ApiProperty({ 
    description: 'Exam end time',
    example: new Date(Date.now() + 3600000).toISOString() 
  })
  @IsDate({ message: 'Exam end time must be a valid Date' })
  @IsNotEmpty()
  @Type(() => Date)
  exam_end_time: Date;

  @ApiProperty({ 
    description: 'Subject of the exam',
    example: "English Literature" 
  })
  @IsNotEmpty({ message: "Subject must be provided" })
  @IsString({ message: "Subject must be a string" })
  @MaxLength(100, { message: "Subject can be maximum 100 characters" })
  subject: string;

  @ApiPropertyOptional({ 
    description: 'Class ID to assign this exam to',
    example: 'uuid-class-id' 
  })
  @IsOptional()
  @IsUUID('4', { message: 'Class ID must be a valid UUID' })
  class_id?: string;

  @ApiPropertyOptional({ 
    description: 'Array of student IDs to exclude from this exam',
    type: [String],
    example: ['uuid-student-1', 'uuid-student-2'] 
  })
  @IsOptional()
  @IsArray({ message: 'Excluded student IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each excluded student ID must be a valid UUID' })
  excluded_student_ids?: string[];

  @ApiProperty({
    description: "List of subjective questions for the exam",
    type: [CreateSubjectiveQuestionDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one question is required' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubjectiveQuestionDto)
  questions: CreateSubjectiveQuestionDto[];
}

// Backward compatible DTO (defaults to objective exam)
export class CreateExamDto extends CreateObjectiveExamDto {}
