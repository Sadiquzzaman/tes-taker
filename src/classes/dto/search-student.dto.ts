import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchStudentDto {
  @ApiPropertyOptional({
    description: 'Search query to find students by name, email, or phone',
    example: 'John',
    minLength: 2,
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @MinLength(2, { message: 'Search query must be at least 2 characters' })
  query?: string;
}
