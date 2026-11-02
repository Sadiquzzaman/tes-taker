import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A holiday or closure (CAL-04): one day (date_to left out) or a range. */
export class CreateHolidayDto {
  @ApiProperty({ example: '2026-12-16', description: "First day, in the organisation's time zone" })
  @Matches(YYYY_MM_DD, { message: 'date_from must be YYYY-MM-DD' })
  date_from: string;

  @ApiPropertyOptional({ example: '2026-12-16', description: 'Last day; left out for a single day' })
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date_to must be YYYY-MM-DD' })
  date_to?: string;

  @ApiPropertyOptional({ example: 'Victory Day', description: 'Optional note (up to 120 characters)' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  name?: string | null;
}

export class UpdateHolidayDto {
  @ApiPropertyOptional({ example: '2026-12-16' })
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date_from must be YYYY-MM-DD' })
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-12-17' })
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'date_to must be YYYY-MM-DD' })
  date_to?: string;

  @ApiPropertyOptional({ example: 'Victory Day', nullable: true })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  name?: string | null;
}

export class ListHolidaysQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Holidays ending on or after this date' })
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Holidays starting on or before this date' })
  @IsOptional()
  @Matches(YYYY_MM_DD, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
