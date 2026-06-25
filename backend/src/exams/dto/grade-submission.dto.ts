import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { GradingStatusEnum } from '../enums/grading-status.enum';

export class QuestionGradeDto {
  @ApiProperty({ description: 'Question UUID' })
  @IsUUID('4', { message: 'Question ID must be a valid UUID' })
  @IsNotEmpty()
  question_id: string;

  @ApiProperty({ description: 'Marks awarded for this question', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  marks_obtained: number;
}

export class GradeSubmissionDto {
  @ApiProperty({ type: [QuestionGradeDto], description: 'Manual question grades' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionGradeDto)
  grades: QuestionGradeDto[];
}

export class GradingListQueryDto {
  @ApiPropertyOptional({ enum: GradingStatusEnum, description: 'Filter by grading status' })
  @IsOptional()
  @IsEnum(GradingStatusEnum)
  status?: GradingStatusEnum;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by test name, subject, or class' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class GradingSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by student name, email, or phone' })
  @IsOptional()
  @IsString()
  search?: string;
}
