import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
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
}
