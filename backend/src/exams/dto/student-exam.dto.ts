import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsArray, 
  IsEnum, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsString, 
  IsUUID, 
  MaxLength, 
  Min, 
  ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';
import { CorrectAnswerEnum } from '../entities/exam-question.entity';

export class StartExamDto {
  @ApiPropertyOptional({ description: 'User agent string from browser' })
  @IsOptional()
  @IsString()
  user_agent?: string;
}

export class AnswerObjectiveQuestionDto {
  @ApiProperty({ description: 'Question UUID', example: 'uuid-question-id' })
  @IsUUID('4', { message: 'Question ID must be a valid UUID' })
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({ 
    description: 'Selected answer option', 
    enum: CorrectAnswerEnum,
    example: CorrectAnswerEnum.OPTION_1 
  })
  @IsEnum(CorrectAnswerEnum, { message: 'Selected answer must be a valid option' })
  @IsNotEmpty()
  selected_answer: CorrectAnswerEnum;
}

export class AnswerSubjectiveQuestionDto {
  @ApiProperty({ description: 'Question UUID', example: 'uuid-question-id' })
  @IsUUID('4', { message: 'Question ID must be a valid UUID' })
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({ 
    description: 'Text answer for the question', 
    example: 'The impact of climate change on Bangladesh includes...' 
  })
  @IsString({ message: 'Answer must be a string' })
  @IsNotEmpty({ message: 'Answer cannot be empty' })
  @MaxLength(10000, { message: 'Answer cannot exceed 10000 characters' })
  text_answer: string;
}

export class SaveAnswerDto {
  @ApiProperty({ description: 'Question UUID', example: 'uuid-question-id' })
  @IsUUID('4', { message: 'Question ID must be a valid UUID' })
  @IsNotEmpty()
  question_id: string;

  @ApiPropertyOptional({ 
    description: 'Selected answer for objective questions', 
    enum: CorrectAnswerEnum 
  })
  @IsOptional()
  @IsEnum(CorrectAnswerEnum, { message: 'Selected answer must be a valid option' })
  selected_answer?: CorrectAnswerEnum;

  @ApiPropertyOptional({ 
    description: 'Text answer for subjective questions' 
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000, { message: 'Answer cannot exceed 10000 characters' })
  text_answer?: string;
}

export class SubmitExamDto {
  @ApiProperty({ 
    description: 'Array of answers to submit', 
    type: [SaveAnswerDto] 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAnswerDto)
  answers: SaveAnswerDto[];

  @ApiPropertyOptional({ description: 'Browser switch count during exam' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  browser_switch_count?: number;

  @ApiPropertyOptional({ description: 'Tab switch count during exam' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tab_switch_count?: number;
}

export class ReportViolationDto {
  @ApiProperty({ 
    description: 'Type of violation',
    enum: ['BROWSER_SWITCH', 'TAB_SWITCH', 'COPY_PASTE', 'RIGHT_CLICK', 'OTHER'],
    example: 'TAB_SWITCH'
  })
  @IsString()
  @IsNotEmpty()
  violation_type: string;

  @ApiPropertyOptional({ description: 'Additional details about the violation' })
  @IsOptional()
  @IsString()
  details?: string;
}

export class GetUpcomingExamsQueryDto {
  @ApiPropertyOptional({ 
    description: 'Sort order for exams',
    enum: ['ASC', 'DESC'],
    default: 'ASC'
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sort_order?: 'ASC' | 'DESC' = 'ASC';

  @ApiPropertyOptional({ 
    description: 'Include past exams',
    default: false
  })
  @IsOptional()
  include_past?: boolean = false;
}
