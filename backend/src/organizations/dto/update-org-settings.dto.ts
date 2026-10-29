import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOrgSettingsDto {
  @ApiPropertyOptional({ description: 'Sections have a class teacher (FND-02)' })
  @IsOptional()
  @IsBoolean()
  class_teacher_enabled?: boolean;
}
