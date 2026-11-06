import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The daily summary: a date (default today) and, optionally, one section. */
export class DailyReportQueryDto {
  @ApiPropertyOptional({ example: '2026-11-07' })
  @IsOptional()
  @Matches(DATE, { message: 'Choose a date as YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  section_id?: string;
}

/** The teacher report: from and to (default today; at most 31 days). */
export class TeacherReportQueryDto {
  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Matches(DATE, { message: 'Choose a date as YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @Matches(DATE, { message: 'Choose a date as YYYY-MM-DD' })
  to?: string;
}
