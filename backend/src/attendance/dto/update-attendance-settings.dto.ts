import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttendanceMethodEnum } from 'src/organizations/enums/attendance-method.enum';
import { ClassAttendanceModeEnum } from 'src/organizations/enums/class-attendance-mode.enum';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/** Any of the attendance settings (ATT-01); fields left out are unchanged. */
export class UpdateAttendanceSettingsDto {
  @ApiPropertyOptional({ enum: AttendanceMethodEnum, description: 'Daily presence method. Today only OFF and WEB can be chosen' })
  @IsOptional()
  @IsEnum(AttendanceMethodEnum)
  attendance_method?: AttendanceMethodEnum;

  @ApiPropertyOptional({
    description: 'Required to change the daily presence method while an academic session is running (409 ATTENDANCE_METHOD_CHANGE_CONFIRM otherwise)',
  })
  @IsOptional()
  @rawValue()
  @IsBoolean()
  confirm_method_change?: boolean;

  @ApiPropertyOptional({ description: 'Selfie with each app check-in; only with the App method' })
  @IsOptional()
  @rawValue()
  @IsBoolean()
  selfie_required?: boolean;

  @ApiPropertyOptional({ enum: ClassAttendanceModeEnum })
  @IsOptional()
  @IsEnum(ClassAttendanceModeEnum)
  class_attendance_mode?: ClassAttendanceModeEnum;

  @ApiPropertyOptional({ type: [Number], example: [5], description: 'ISO day numbers, 1 = Monday … 7 = Sunday; at least one working day' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekly_off_days?: number[];

  @ApiPropertyOptional({ example: '09:00', description: "HH:MM in the organisation's time zone" })
  @IsOptional()
  @Matches(HH_MM, { message: 'student_entry_time must be HH:MM' })
  student_entry_time?: string;

  @ApiPropertyOptional({ example: '08:45', description: "HH:MM in the organisation's time zone" })
  @IsOptional()
  @Matches(HH_MM, { message: 'teacher_entry_time must be HH:MM' })
  teacher_entry_time?: string;

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
