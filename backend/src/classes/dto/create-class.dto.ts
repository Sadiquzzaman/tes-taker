import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({
    description: 'Name of the class',
    example: 'Mathematics 101',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Class name is required' })
  @IsString({ message: 'Class name must be a string' })
  @MaxLength(100, { message: 'Class name cannot exceed 100 characters' })
  class_name: string;

  @ApiPropertyOptional({
    description: 'Description of the class',
    example: 'Introduction to calculus and basic algebra',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Array of student emails and phone numbers to add to the class',
    example: ['01712345678', 'student@example.com', '01798765432'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Student contacts must be an array' })
  @IsString({ each: true, message: 'Each contact must be a string (email or phone number)' })
  students?: string[];
}
