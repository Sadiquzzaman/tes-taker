import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateClassDto {
  @ApiPropertyOptional({
    description: 'Name of the class',
    example: 'Mathematics 102',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Class name must be a string' })
  @MaxLength(100, { message: 'Class name cannot exceed 100 characters' })
  class_name?: string;

  @ApiPropertyOptional({
    description: 'Description of the class',
    example: 'Advanced calculus and linear algebra',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;
}

export class AddStudentsToClassDto {
  @ApiPropertyOptional({
    description: 'Array of student emails and phone numbers to add to the class',
    example: ['01712345678', 'student@example.com', '01798765432'],
    type: [String],
  })
  @IsArray({ message: 'Student contacts must be an array' })
  @IsString({ each: true, message: 'Each contact must be a string (email or phone number)' })
  students: string[];
}

export class RemoveStudentsFromClassDto {
  @ApiPropertyOptional({
    description: 'Array of student IDs to remove from the class',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray({ message: 'Student IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each student ID must be a valid UUID' })
  student_ids: string[];
}
