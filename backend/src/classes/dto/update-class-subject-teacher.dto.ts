import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateClassSubjectTeacherDto {
  @ApiProperty({ description: 'Replacement teacher user UUID' })
  @IsUUID()
  teacher_id: string;
}
