import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
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
