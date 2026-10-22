import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrganizationSubjectDto {
  @ApiPropertyOptional({ example: 'Physics', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'PHY-09', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}
