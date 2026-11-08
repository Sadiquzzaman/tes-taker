import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { SectionShiftEnum } from 'src/academics/entities/section.entity';
import { MAX_SLOTS_PER_SECTION } from 'src/calendar/routine-slots.service';
import { SectionAttendanceModeEnum, SectionClassTypeEnum } from '../entities/section-attendance-settings.entity';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The value as sent: implicit conversion would turn `null` into 0 and "false" into true. */
const raw = () => Transform(({ obj, key }) => (obj as Record<string, unknown>)[key]);

export class SetupQueryDto {
  @ApiPropertyOptional({ description: "Default: the organisation's default session" })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

/** A section's attendance setup (ATT-16); fields left out are unchanged. */
export class UpdateSectionSetupDto {
  @ApiPropertyOptional({ nullable: true, description: 'A branch of the organisation; null = the main branch (Owner/Admin/Assistant only)' })
  @IsOptional()
  @raw()
  @IsUUID()
  branch_id?: string | null;

  @ApiPropertyOptional({ enum: SectionClassTypeEnum, description: 'ONLINE: check in from anywhere' })
  @IsOptional()
  @IsEnum(SectionClassTypeEnum)
  class_type?: SectionClassTypeEnum;

  @ApiPropertyOptional({ enum: SectionAttendanceModeEnum })
  @IsOptional()
  @IsEnum(SectionAttendanceModeEnum)
  mode?: SectionAttendanceModeEnum;

  @ApiPropertyOptional({ nullable: true, example: 5, description: "Minutes before Late (0–60); null = the organisation's grace period" })
  @IsOptional()
  @raw()
  @IsInt()
  @Min(0)
  @Max(60)
  grace_minutes?: number | null;
}

export class SlotDto {
  @ApiProperty({ example: 6, description: 'ISO day: 1 = Monday … 6 = Saturday, 7 = Sunday' })
  @IsInt()
  @Min(1)
  @Max(7)
  day_of_week: number;

  @ApiProperty({ example: '16:00', description: "HH:MM in the organisation's time zone" })
  @Matches(HH_MM, { message: 'start_time must be HH:MM' })
  start_time: string;

  @ApiProperty({ example: '17:30' })
  @Matches(HH_MM, { message: 'end_time must be HH:MM' })
  end_time: string;

  @ApiPropertyOptional({ nullable: true, description: 'Optional: a teaching member of the organisation' })
  @IsOptional()
  @raw()
  @IsUUID()
  teacher_id?: string | null;
}

/** The whole weekly schedule of a section; an empty list clears it. */
export class ReplaceSlotsDto {
  @ApiProperty({ type: [SlotDto] })
  @IsArray()
  @ArrayMaxSize(MAX_SLOTS_PER_SECTION)
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots: SlotDto[];
}

export class CopyScheduleDto {
  @ApiProperty({ description: 'The section whose schedule is copied (same session); teachers are not copied' })
  @IsUUID()
  from_section_id: string;
}

/** Apply one section's schedule and/or its type, mode and grace to a class or a shift. */
export class ApplyScheduleDto {
  @ApiProperty()
  @IsUUID()
  from_section_id: string;

  @ApiPropertyOptional({ description: 'Every other section of this class in the session; give this or shift' })
  @IsOptional()
  @IsUUID()
  class_id?: string;

  @ApiPropertyOptional({ enum: SectionShiftEnum, description: 'Every other section of this shift in the session; give this or class_id' })
  @IsOptional()
  @IsEnum(SectionShiftEnum)
  shift?: SectionShiftEnum;

  @ApiPropertyOptional({ description: 'Copy the weekly schedule (default true); false copies only the settings (the routine copies schedules now)' })
  @IsOptional()
  @raw()
  @IsBoolean()
  include_schedule?: boolean;

  @ApiPropertyOptional({ description: 'Also copy in person / online, the mode and the grace period (never the branch)' })
  @IsOptional()
  @raw()
  @IsBoolean()
  include_settings?: boolean;

  @ApiPropertyOptional({ description: 'Only list the sections that would change' })
  @IsOptional()
  @raw()
  @IsBoolean()
  dry_run?: boolean;
}
