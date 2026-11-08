import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const HH_MM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** `GET /routine` */
export class RoutineQueryDto {
  @ApiPropertyOptional({ description: 'Session; the default session when left out' })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

/** The parts of a routine slot that can change (CAL-01). */
export class UpdateRoutineSlotDto {
  @ApiPropertyOptional({ example: 6, description: 'ISO day: 1 Monday … 7 Sunday' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  day_of_week?: number;

  @ApiPropertyOptional({ example: '10:00', description: "HH:MM in the organisation's time zone" })
  @IsOptional()
  @Matches(HH_MM, { message: 'start_time must be HH:MM' })
  start_time?: string;

  @ApiPropertyOptional({ example: '10:45' })
  @IsOptional()
  @Matches(HH_MM, { message: 'end_time must be HH:MM' })
  end_time?: string;

  @ApiPropertyOptional({ description: "One of the section's subject classes; null = no subject" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  offering_id?: string | null;

  @ApiPropertyOptional({ description: 'A teaching member; null = no teacher' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teacher_id?: string | null;

  @ApiPropertyOptional({ example: 'Room 201', description: 'Free text, at most 40 characters; null = none' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  room?: string | null;

  @ApiPropertyOptional({ description: 'Save even though the teacher or room is booked at that time (CAL-02)' })
  @IsOptional()
  @IsBoolean()
  confirm_clashes?: boolean;
}

/** `POST /routine/slots` */
export class RoutineSlotInputDto extends UpdateRoutineSlotDto {
  @ApiProperty()
  @IsUUID()
  section_id: string;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @Max(7)
  declare day_of_week: number;

  @ApiProperty({ example: '10:00' })
  @Matches(HH_MM, { message: 'start_time must be HH:MM' })
  declare start_time: string;

  @ApiProperty({ example: '10:45' })
  @Matches(HH_MM, { message: 'end_time must be HH:MM' })
  declare end_time: string;
}

/** `POST /routine/slots/many`: the same period on several days. */
export class RoutineSlotsInputDto extends UpdateRoutineSlotDto {
  @ApiProperty()
  @IsUUID()
  section_id: string;

  @ApiProperty({ example: [6, 1, 3], description: 'ISO days: 1 Monday … 7 Sunday' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days: number[];

  @ApiProperty({ example: '10:00' })
  @Matches(HH_MM, { message: 'start_time must be HH:MM' })
  declare start_time: string;

  @ApiProperty({ example: '10:45' })
  @Matches(HH_MM, { message: 'end_time must be HH:MM' })
  declare end_time: string;
}

/** `POST /routine/sections/:id/copy`: replace this section's week with another section's. */
export class CopyRoutineDto {
  @ApiProperty()
  @IsUUID()
  from_section_id: string;
}
