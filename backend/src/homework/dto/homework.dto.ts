import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { HomeworkStatusEnum, HomeworkTypeEnum } from '../entities/homework.entity';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Most subject classes, students and files on one homework. */
export const MAX_HOMEWORK_OFFERINGS = 20;
export const MAX_HOMEWORK_STUDENTS = 500;
export const MAX_HOMEWORK_ATTACHMENTS = 10;

/** A homework as a teacher writes it (HW-01). It is saved as a draft; publishing is its own step. */
export class CreateHomeworkDto {
  @ApiProperty({ example: 'Chapter 3 exercise' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: "Rich text: the editor's JSON document" })
  @IsOptional()
  @IsObject()
  instructions?: Record<string, unknown>;

  @ApiProperty({ enum: HomeworkTypeEnum, description: 'FILE (photos or files), TEXT (typed answer) or PAPER (done on paper; nothing to upload)' })
  @IsEnum(HomeworkTypeEnum)
  submission_type: HomeworkTypeEnum;

  @ApiPropertyOptional({ example: 10, description: 'Out of how many marks; empty = not scored' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(1000)
  total_marks?: number | null;

  @ApiPropertyOptional({ example: '2026-11-12T18:00:00.000Z', description: 'When it is due (ISO time); empty = no due date' })
  @IsOptional()
  @IsDateString()
  due_at?: string | null;

  @ApiProperty({ type: [String], description: 'Subject classes (one subject, one session); everyone taking them unless student_ids is given' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_HOMEWORK_OFFERINGS)
  @IsUUID('4', { each: true })
  offering_ids: string[];

  @ApiPropertyOptional({ type: [String], description: 'Only these students (each must take one of the subject classes)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOMEWORK_STUDENTS)
  @IsUUID('4', { each: true })
  student_ids?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Uploaded files (purpose HOMEWORK), in order' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOMEWORK_ATTACHMENTS)
  @IsUUID('4', { each: true })
  attachment_ids?: string[];
}

/** Changes to a homework; targets and type only while it is a draft or scheduled. */
export class UpdateHomeworkDto extends PartialType(CreateHomeworkDto) {}

/** Publish now, or schedule for later with `publish_at`. */
export class PublishHomeworkDto {
  @ApiPropertyOptional({ example: '2026-11-10T02:00:00.000Z', description: 'Publish then (must be in the future); empty = now' })
  @IsOptional()
  @IsDateString()
  publish_at?: string;
}

export const HOMEWORK_LIST_STATUSES = ['ACTIVE', ...Object.values(HomeworkStatusEnum)] as const;

/** The staff list: by default everything but withdrawn homework, newest first. */
export class ListHomeworkQueryDto {
  @ApiPropertyOptional({ enum: HOMEWORK_LIST_STATUSES, description: 'ACTIVE (default) = draft, scheduled and published' })
  @IsOptional()
  @IsIn(HOMEWORK_LIST_STATUSES)
  status?: (typeof HOMEWORK_LIST_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Only homework for this subject class' })
  @IsOptional()
  @IsUUID()
  offering_id?: string;
}

/** A student's hand-in (HW-03): files (photos, PDF, …) and/or a typed answer, depending on the homework. */
export class SubmitHomeworkDto {
  @ApiPropertyOptional({ description: 'The typed answer (required for TEXT homework)' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(20_000)
  text_answer?: string;

  @ApiPropertyOptional({ type: [String], description: "The student's uploads (purpose HOMEWORK), in page order" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOMEWORK_ATTACHMENTS)
  @IsUUID('4', { each: true })
  file_ids?: string[];
}

export const LATE_PENALTY_TYPES = ['NONE', 'PER_DAY', 'FIXED'] as const;

class LatePenaltyDto {
  @ApiProperty({ enum: LATE_PENALTY_TYPES })
  @IsIn(LATE_PENALTY_TYPES)
  type: (typeof LATE_PENALTY_TYPES)[number];

  @ApiProperty({ example: 10, description: 'Percent off per day late (PER_DAY) or once (FIXED); ignored for NONE' })
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  @Max(100)
  percent: number;
}

/** The organisation's homework settings (Epic 2 settings table); owners and admins change them. */
export class UpdateHomeworkSettingsDto {
  @ApiPropertyOptional({ description: 'Accept work after the due time (marked late)' })
  @IsOptional()
  // Keep the raw value: the global implicit conversion would turn the string "false" into true.
  @Transform(({ obj, key }) => (obj as Record<string, unknown>)[key])
  @IsBoolean()
  late_allowed?: boolean;

  @ApiPropertyOptional({ type: LatePenaltyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LatePenaltyDto)
  late_penalty?: LatePenaltyDto;

  @ApiPropertyOptional({ example: 1, description: 'Hand-ins allowed after the first, before it is scored (0–3)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  resubmissions?: number;

  @ApiPropertyOptional({ example: 5, description: 'Most files in one submission (1–10)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  max_files?: number;
}
