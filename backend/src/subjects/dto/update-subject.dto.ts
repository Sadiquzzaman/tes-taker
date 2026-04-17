import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @ApiPropertyOptional({ description: 'Subject display name', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Optional unique code', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;
}
