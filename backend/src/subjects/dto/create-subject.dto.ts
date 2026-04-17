import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ description: 'Subject display name', example: 'Mathematics', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Optional unique code', example: 'MATH', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}
