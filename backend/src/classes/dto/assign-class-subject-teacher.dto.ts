import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignClassSubjectTeacherDto {
  @ApiProperty({ description: 'Teacher user UUID' })
  @IsUUID()
  teacher_id: string;

  @ApiPropertyOptional({
    description: 'Optional: also mirror into legacy ClassTeacher for compatibility',
    default: true,
  })
  @IsOptional()
  mirror_class_teacher?: boolean;
}
