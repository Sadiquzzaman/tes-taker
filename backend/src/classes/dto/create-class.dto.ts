import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClassKindEnum } from '../enums/class-kind.enum';

export class NewClassSubjectDto {
  @ApiProperty({ example: 'Physics', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'PHY-09', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;
}

export class CreateClassDto {
  @ApiProperty({
    description: 'Name of the class',
    example: 'Class 9 - Section A',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Class name is required' })
  @IsString({ message: 'Class name must be a string' })
  @MaxLength(100, { message: 'Class name cannot exceed 100 characters' })
  class_name: string;

  @ApiPropertyOptional({
    description: 'Description of the class',
    example: 'Organization academic class',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    enum: ClassKindEnum,
    description:
      'PERSONAL = teacher-owned; ORGANIZATION = shared academic class. Defaults from context.',
  })
  @IsOptional()
  @IsEnum(ClassKindEnum)
  class_kind?: ClassKindEnum;

  @ApiPropertyOptional({
    description: 'Global subject UUIDs to attach to this class',
    type: [String],
    example: ['uuid-physics', 'uuid-math'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subject_ids?: string[];

  @ApiPropertyOptional({
    description: 'Subject names to find-or-create and attach (organization managers)',
    type: [String],
    example: ['Physics'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subject_names?: string[];

  @ApiPropertyOptional({
    description: 'Organization subjects to find-or-create by name and code',
    type: [NewClassSubjectDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NewClassSubjectDto)
  new_subjects?: NewClassSubjectDto[];

  @ApiPropertyOptional({
    description: 'Array of student emails and phone numbers to add to the class',
    example: ['01712345678', 'student@example.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Student contacts must be an array' })
  @IsString({ each: true, message: 'Each contact must be a string (email or phone number)' })
  students?: string[];
}
