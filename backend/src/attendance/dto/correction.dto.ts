import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AttendanceStatusEnum } from '../entities/attendance-record.entity';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Statuses a correction can set. LEAVE comes only from an approved leave request (P3-06). */
export const CORRECTABLE_STATUSES = [AttendanceStatusEnum.PRESENT, AttendanceStatusEnum.LATE, AttendanceStatusEnum.ABSENT] as const;

/** `GET /attendance/sessions`: the classes on a school date (default today). */
export class SessionsQueryDto {
  @ApiPropertyOptional({ example: '2026-11-07' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}

/** A correction (ATT-07, ATT-12): the new status and why. */
export class CorrectRecordDto {
  @ApiProperty({ enum: CORRECTABLE_STATUSES })
  @IsIn(CORRECTABLE_STATUSES)
  status: AttendanceStatusEnum;

  @ApiProperty({ example: 'Her phone had no internet; she was in class' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ example: 12, description: 'LATE only: minutes after the start (kept from the check-in when left out)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  late_minutes?: number;
}

/** Cancelling one class for a day (ATT-19): an optional note for the students. */
export class CancelClassDto {
  @ApiPropertyOptional({ example: 'I am unwell; we will make it up on Monday' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(300)
  note?: string;
}

/**
 * Changing one class for a day (P5-04, CAL-01): other times that day and/or a substitute teacher.
 * Sending the routine's own times and no substitute undoes the change.
 */
export class ChangeClassDto {
  @ApiPropertyOptional({ example: '11:00', description: "New start that day, HH:MM in the organisation's time zone (with end_time)" })
  @IsOptional()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'start_time must be HH:MM' })
  start_time?: string;

  @ApiPropertyOptional({ example: '11:45' })
  @IsOptional()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'end_time must be HH:MM' })
  end_time?: string;

  @ApiPropertyOptional({ description: 'Teaches this class that day; null = the routine\'s teacher' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  substitute_teacher_id?: string | null;

  @ApiPropertyOptional({ example: 'Moved to after lunch this Monday' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(300)
  note?: string;
}
