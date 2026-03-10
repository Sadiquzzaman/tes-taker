import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";

export enum CorrectAnswerEnum {
  OPTION_1 = "Option 1",
  OPTION_2 = "Option 2",
  OPTION_3 = "Option 3",
  OPTION_4 = "Option 4",
}

export enum QuestionTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

export class CreateObjectiveQuestionDto {
  @ApiProperty({ 
    description: 'The question text',
    example: "What is the capital of Bangladesh?" 
  })
  @IsNotEmpty({ message: "Question must be provided" })
  @IsString({ message: "Question must be a string" })
  @MaxLength(2000, { message: "Question can be maximum 2000 characters" })
  question: string;

  @ApiProperty({ 
    description: 'First answer option (required)',
    example: "Dhaka" 
  })
  @IsNotEmpty({ message: "Option 1 must be provided" })
  @IsString({ message: "Option 1 must be a string" })
  @MaxLength(255, { message: "Option 1 can be maximum 255 characters" })
  option1: string;

  @ApiProperty({ 
    description: 'Second answer option (required)',
    example: "Chittagong" 
  })
  @IsNotEmpty({ message: "Option 2 must be provided" })
  @IsString({ message: "Option 2 must be a string" })
  @MaxLength(255, { message: "Option 2 can be maximum 255 characters" })
  option2: string;

  @ApiPropertyOptional({ 
    description: 'Third answer option (optional)',
    example: "Khulna" 
  })
  @IsOptional()
  @IsString({ message: "Option 3 must be a string" })
  @MaxLength(255, { message: "Option 3 can be maximum 255 characters" })
  option3?: string;

  @ApiPropertyOptional({ 
    description: 'Fourth answer option (optional)',
    example: "Rajshahi" 
  })
  @IsOptional()
  @IsString({ message: "Option 4 must be a string" })
  @MaxLength(255, { message: "Option 4 can be maximum 255 characters" })
  option4?: string;

  @ApiProperty({ 
    description: 'The correct answer',
    enum: CorrectAnswerEnum, 
    example: CorrectAnswerEnum.OPTION_1 
  })
  @IsEnum(CorrectAnswerEnum, {
    message: "Correct answer must be one of: Option 1, Option 2, Option 3, Option 4",
  })
  correct_answer: CorrectAnswerEnum;

  @ApiPropertyOptional({ 
    description: 'Explanation for the correct answer',
    example: "Dhaka is the capital of Bangladesh" 
  })
  @IsOptional()
  @IsString({ message: "Explanation must be a string" })
  @MaxLength(2000, { message: "Explanation can be maximum 2000 characters" })
  explanation?: string;
}

export class CreateSubjectiveQuestionDto {
  @ApiProperty({ 
    description: 'The question text',
    example: "Describe the impact of climate change on Bangladesh" 
  })
  @IsNotEmpty({ message: "Question must be provided" })
  @IsString({ message: "Question must be a string" })
  @MaxLength(2000, { message: "Question can be maximum 2000 characters" })
  question: string;

  @ApiPropertyOptional({ 
    description: 'Expected word limit for the answer',
    example: 500 
  })
  @IsOptional()
  @IsNumber({}, { message: "Expected word limit must be a number" })
  @Min(10, { message: "Expected word limit must be at least 10" })
  expected_word_limit?: number;

  @ApiPropertyOptional({ 
    description: 'Marks allocated for this question',
    example: 10 
  })
  @IsOptional()
  @IsNumber({}, { message: "Marks per question must be a number" })
  @Min(1, { message: "Marks must be at least 1" })
  marks_per_question?: number;

  @ApiPropertyOptional({ 
    description: 'Sample answer for reference',
    example: "Climate change has significantly impacted Bangladesh through..." 
  })
  @IsOptional()
  @IsString({ message: "Sample answer must be a string" })
  @MaxLength(5000, { message: "Sample answer can be maximum 5000 characters" })
  sample_answer?: string;
}

// Backward compatible DTO for objective questions
export class CreateExamQuestionDto extends CreateObjectiveQuestionDto {}
