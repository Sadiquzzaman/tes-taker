import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTeacherSubjectDto {
  @ApiProperty({ description: 'Subject UUID to assign to the teacher' })
  @IsUUID()
  subject_id: string;
}
