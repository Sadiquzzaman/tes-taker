import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export const MAX_SCHEDULE_IMPORT_ROWS = 1000;

/**
 * One line of the schedule CSV (ATT-16): a section and one weekly time on one or more days. A
 * section may have several lines. Every cell is optional here; the preview reports problems per row.
 */
export class ScheduleImportRowDto {
  @ApiPropertyOptional({ example: 'Class 6' }) @IsOptional() @IsString() @MaxLength(200) class?: string;
  @ApiPropertyOptional({ example: 'A' }) @IsOptional() @IsString() @MaxLength(200) section?: string;
  @ApiPropertyOptional({ example: 'Sat;Mon', description: 'Days separated by ; (English or Bangla names, or ISO 1–7)' })
  @IsOptional() @IsString() @MaxLength(200) days?: string;
  @ApiPropertyOptional({ example: '16:00', description: '24-hour or 4:00 PM' }) @IsOptional() @IsString() @MaxLength(200) start?: string;
  @ApiPropertyOptional({ example: '17:30' }) @IsOptional() @IsString() @MaxLength(200) end?: string;
  @ApiPropertyOptional({ example: 'In person', description: 'In person / Online; empty = unchanged' })
  @IsOptional() @IsString() @MaxLength(200) class_type?: string;
  @ApiPropertyOptional({ example: 'Self check-in', description: 'Self check-in / Paper register; empty = unchanged' })
  @IsOptional() @IsString() @MaxLength(200) mode?: string;
  @ApiPropertyOptional({ example: '10', description: '0–60 minutes, or "default"; empty = unchanged' })
  @IsOptional() @IsString() @MaxLength(200) grace?: string;
  @ApiPropertyOptional({ example: 'Farmgate', description: 'A branch name, or "main"; empty = unchanged (Owner/Admin/Assistant)' })
  @IsOptional() @IsString() @MaxLength(200) branch?: string;
}

/** The schedule CSV's rows; each section named in the file gets exactly the times listed for it. */
export class ScheduleImportDto {
  @ApiPropertyOptional({ description: "Default: the organisation's default session" })
  @IsOptional()
  @IsUUID()
  session_id?: string;

  @ApiProperty({ type: [ScheduleImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCHEDULE_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ScheduleImportRowDto)
  rows: ScheduleImportRowDto[];
}
