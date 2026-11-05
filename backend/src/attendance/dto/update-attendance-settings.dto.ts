import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * The value as sent: the global pipe's implicit conversion would turn any string (even "false")
 * into true, so a switch would flip instead of being rejected.
 */
const rawValue = () => Transform(({ obj, key }) => (obj as Record<string, unknown>)[key]);

export class GuardianSmsDto {
  @ApiPropertyOptional({ description: 'SMS when a student arrives late (ATT-06)' })
  @IsOptional()
  @rawValue()
  @IsBoolean()
  late?: boolean;

  @ApiPropertyOptional({ description: 'SMS when a student is absent (ATT-10)' })
  @IsOptional()
  @rawValue()
  @IsBoolean()
  absent?: boolean;

  @ApiPropertyOptional({ description: 'SMS when leave is applied for (ATT-09)' })
  @IsOptional()
  @rawValue()
  @IsBoolean()
  leave?: boolean;
}

/** Any of the organisation attendance settings (ATT-01 as changed on 5 Nov 2026); fields left out are unchanged. */
export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ example: 10, description: 'Minutes after a class starts before a check-in is Late (0–60); a section can override it' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  late_grace_minutes?: number;

  @ApiPropertyOptional({ type: [Number], example: [5], description: 'ISO day numbers, 1 = Monday … 7 = Sunday; at least one working day' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekly_off_days?: number[];

  @ApiPropertyOptional({ type: GuardianSmsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianSmsDto)
  guardian_sms?: GuardianSmsDto;

  @ApiPropertyOptional({ example: 3, description: 'School days absent in a row before the class teacher is alerted (2–30)' })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(30)
  repeat_absence_days?: number;
}
