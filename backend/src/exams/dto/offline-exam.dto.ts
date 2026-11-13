import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OfflineExamPartDto {
  @ApiProperty({ example: 'MCQ' })
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiProperty({ example: 30 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(1000)
  marks: number;
}

export class CreateOfflineExamDto {
  @ApiProperty({ description: 'The subject class (section + subject)' })
  @IsUUID()
  offering_id: string;

  @ApiProperty({ example: 'Half-yearly exam' })
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiProperty({ example: '2026-12-10' })
  @IsDateString({ strict: true })
  exam_date: string;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  total_marks: number;

  @ApiPropertyOptional({ type: [OfflineExamPartDto], description: 'Parts adding up to the total (at most 6)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OfflineExamPartDto)
  parts?: OfflineExamPartDto[] | null;

  @ApiPropertyOptional({ description: 'A term of the session' })
  @IsOptional()
  @IsUUID()
  term_id?: string | null;
}

export class UpdateOfflineExamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  exam_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  total_marks?: number;

  @ApiPropertyOptional({ type: [OfflineExamPartDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OfflineExamPartDto)
  parts?: OfflineExamPartDto[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  term_id?: string | null;
}

export class ListOfflineExamsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  offering_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

export class OfflineMarkRowDto {
  @ApiProperty()
  @IsUUID()
  student_id: string;

  @ApiPropertyOptional({ example: 72.5, description: 'Marks out of the total (exams without parts); null clears' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  marks?: number | null;

  @ApiPropertyOptional({ description: 'Marks per part name (exams with parts); the total is their sum' })
  @IsOptional()
  @IsObject()
  part_marks?: Record<string, number> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_absent?: boolean;
}

export class SaveOfflineMarksDto {
  @ApiProperty({ type: [OfflineMarkRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OfflineMarkRowDto)
  rows: OfflineMarkRowDto[];
}
