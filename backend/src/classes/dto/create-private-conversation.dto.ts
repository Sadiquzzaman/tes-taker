import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreatePrivateConversationDto {
  @ApiPropertyOptional({ description: 'Teacher UUID (required for students)' })
  @IsOptional()
  @IsUUID()
  teacher_id?: string;

  @ApiPropertyOptional({ description: 'Student UUID (required for teachers)' })
  @IsOptional()
  @IsUUID()
  student_id?: string;
}
