import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';

export enum SelectableContextTypeEnum {
  PERSONAL_TEACHER = 'personal_teacher',
  ORGANIZATION = 'organization',
  /** Student enrolled in a personal (non-org) teacher's classes */
  INDIVIDUAL_TEACHER = 'individual_teacher',
}

export class SelectContextDto {
  @ApiProperty({ enum: SelectableContextTypeEnum })
  @IsEnum(SelectableContextTypeEnum)
  type: SelectableContextTypeEnum;

  @ApiPropertyOptional({
    description: 'Required when type is organization',
    format: 'uuid',
  })
  @ValidateIf((o) => o.type === SelectableContextTypeEnum.ORGANIZATION)
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({
    description: 'Required when type is individual_teacher (the teacher user UUID)',
    format: 'uuid',
  })
  @ValidateIf((o) => o.type === SelectableContextTypeEnum.INDIVIDUAL_TEACHER)
  @IsUUID()
  teacher_id?: string;
}
