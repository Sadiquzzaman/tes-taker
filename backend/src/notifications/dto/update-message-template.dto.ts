import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMessageTemplateDto {
  @ApiPropertyOptional({ description: 'Email subject (null for SMS)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string | null;

  @ApiPropertyOptional({ description: 'Text with {{variables}}; HTML for email' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body?: string;
}
