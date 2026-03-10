import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';

export class AddStudentsBulkDto {
  @ApiProperty({
    description: 'Array of phone numbers or email addresses to add as students',
    example: ['01712345678', 'student@example.com', '01798765432'],
    type: [String],
  })
  @IsArray({ message: 'Contacts must be an array' })
  @ArrayMinSize(1, { message: 'At least one contact is required' })
  @IsString({ each: true, message: 'Each contact must be a string' })
  contacts: string[];
}
