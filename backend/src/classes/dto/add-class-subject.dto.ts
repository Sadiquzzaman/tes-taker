import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class AddClassSubjectDto {
  @ApiPropertyOptional({ description: 'Existing global subject UUID' })
  @ValidateIf((o: AddClassSubjectDto) => !o.name)
  @IsUUID()
  subject_id?: string;

  @ApiPropertyOptional({ description: 'Create or reuse a subject by display name' })
  @ValidateIf((o: AddClassSubjectDto) => !o.subject_id)
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Required with name for organization subjects' })
  @ValidateIf((o: AddClassSubjectDto) => Boolean(o.name) && !o.subject_id)
  @IsString()
  @MaxLength(50)
  code?: string;
}
