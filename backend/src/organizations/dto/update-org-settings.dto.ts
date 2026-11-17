import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ORGANIZATION_LOCALES, OrganizationLocale } from '../org-settings.service';

export class UpdateOrgSettingsDto {
  @ApiPropertyOptional({ description: 'Sections have a class teacher (FND-02)' })
  @IsOptional()
  @IsBoolean()
  class_teacher_enabled?: boolean;

  @ApiPropertyOptional({ enum: ORGANIZATION_LOCALES, description: 'Language for members who have not chosen one (FND-18)' })
  @IsOptional()
  @IsIn(ORGANIZATION_LOCALES)
  default_locale?: OrganizationLocale;

  @ApiPropertyOptional({ enum: ORGANIZATION_LOCALES, description: 'Language of SMS to guardians (FND-10); a student can override it' })
  @IsOptional()
  @IsIn(ORGANIZATION_LOCALES)
  sms_locale?: OrganizationLocale;

  @ApiPropertyOptional({ description: 'Use branches (P12-01); switching off needs every branch but the main one removed' })
  @IsOptional()
  @IsBoolean()
  branches_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Keep and show guardians (P12-03); default on for Academic, off for IELTS' })
  @IsOptional()
  @IsBoolean()
  guardians_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Students still see an ended IELTS course this many days (P12-04); 0–365' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  ended_course_visible_days?: number;
}
