import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AssignClassTeacherDto {
  @ApiProperty({ description: 'Teacher user UUID (must be an org member when in org context)' })
  @IsUUID()
  @IsNotEmpty()
  teacher_id: string;

  @ApiPropertyOptional({ description: 'Optional subject UUID for this class assignment' })
  @IsOptional()
  @IsUUID()
  subject_id?: string;
}
