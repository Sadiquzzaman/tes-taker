import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
    description: 'Array of student IDs to add to the class',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Student IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each student ID must be a valid UUID' })
  student_ids?: string[];
}
