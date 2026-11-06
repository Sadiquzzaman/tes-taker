import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { LeaveStatusEnum } from '../entities/leave-request.entity';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A leave application (ATT-09, ATT-11): whole school days with a reason. */
export class ApplyLeaveDto {
  @ApiProperty({ example: '2026-11-08', description: "First day of leave (a date in the organisation's time zone)" })
  @Matches(DATE)
  from_date: string;

  @ApiProperty({ example: '2026-11-10', description: 'Last day of leave (the same as from_date for one day)' })
  @Matches(DATE)
  to_date: string;

  @ApiProperty({ example: 'Fever; the doctor asked for three days of rest' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: "An uploaded file (purpose LEAVE), e.g. a doctor's note" })
  @IsOptional()
  @IsUUID()
  file_id?: string;

  @ApiPropertyOptional({ description: 'Apply for someone else: a student (their teachers, admins, office staff) or a teacher (owners, admins). Default: yourself' })
  @IsOptional()
  @IsUUID()
  person_id?: string;
}

/** Approving: an optional comment for the person. */
export class ApproveLeaveDto {
  @ApiPropertyOptional({ example: 'Get well soon' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Rejecting: a comment is required, so the person knows why. */
export class RejectLeaveDto {
  @ApiProperty({ example: 'The exam is on Monday; please come for it' })
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  note: string;
}

export const LEAVE_LIST_FILTERS = ['PENDING', 'DECIDED', 'ALL'] as const;
export type LeaveListFilter = (typeof LEAVE_LIST_FILTERS)[number];

/** `GET /attendance/leave/approvals`: waiting requests (default), decided ones or all. */
export class LeaveApprovalsQueryDto {
  @ApiPropertyOptional({ enum: LEAVE_LIST_FILTERS, default: 'PENDING' })
  @IsOptional()
  @IsIn(LEAVE_LIST_FILTERS)
  status?: LeaveListFilter;
}

/** `GET /attendance/leave/people`: whom the caller may apply for, by name. */
export class LeavePeopleQueryDto {
  @ApiPropertyOptional({ example: 'Rahim' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** Statuses after a decision or a withdrawal. */
export const DECIDED_LEAVE_STATUSES = [LeaveStatusEnum.APPROVED, LeaveStatusEnum.REJECTED, LeaveStatusEnum.CANCELLED];
