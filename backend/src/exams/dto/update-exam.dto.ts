import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { CreateExamQuestionDto } from './create-exam-question.dto';

export class UpdateExamQuestionDto extends PartialType(CreateExamQuestionDto) {}

export class UpdateExcludedStudentsDto {
  @ApiProperty({
    description: 'Array of student IDs to exclude from the exam',
    example: ['uuid-student-1', 'uuid-student-2'],
    type: [String],
  })
  @IsArray({ message: 'Student IDs must be an array' })
  @IsUUID('4', { each: true, message: 'Each student ID must be a valid UUID' })
  student_ids: string[];
}
