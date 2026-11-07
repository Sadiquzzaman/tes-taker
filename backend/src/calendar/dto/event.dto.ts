import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { EventTypeEnum } from '../entities/event.entity';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/** `GET /events`: events from `from` to `to` (school dates, at most 62 days). */
export class EventsQueryDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(YYYY_MM_DD, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @ApiProperty({ example: '2026-11-30' })
  @Matches(YYYY_MM_DD, { message: 'to must be YYYY-MM-DD' })
  to: string;
}

/** What can change on an event (CAL-03). */
export class UpdateEventDto {
  @ApiPropertyOptional({ enum: EventTypeEnum })
  @IsOptional()
  @IsEnum(EventTypeEnum)
  type?: EventTypeEnum;

  @ApiPropertyOptional({ example: 'Parent meeting, Class 8' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimmed)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-11-20T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional({ example: '2026-11-20T11:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional({ example: 'Main hall' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  place?: string | null;

  @ApiPropertyOptional({ description: 'Everyone in the organisation (owners, admins and assistants only)' })
  @IsOptional()
  @IsBoolean()
  whole_org?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Sections whose students attend' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  section_ids?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Teachers or students who attend' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  user_ids?: string[];
}

/** `POST /events` */
export class CreateEventDto extends UpdateEventDto {
  @ApiProperty({ enum: EventTypeEnum })
  @IsEnum(EventTypeEnum)
  declare type: EventTypeEnum;

  @ApiProperty({ example: 'Parent meeting, Class 8' })
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare title: string;

  @ApiProperty({ example: '2026-11-20T09:00:00.000Z' })
  @IsDateString()
  declare starts_at: string;

  @ApiProperty({ example: '2026-11-20T11:00:00.000Z' })
  @IsDateString()
  declare ends_at: string;
}

/** `POST /events/:id/cancel`: an optional note for the attendees. */
export class CancelEventDto {
  @ApiPropertyOptional({ example: 'Moved to next month' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(300)
  note?: string;
}
