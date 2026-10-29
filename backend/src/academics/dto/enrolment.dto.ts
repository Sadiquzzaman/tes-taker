import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { EnrolmentStatusEnum } from '../entities/enrolment.entity';

/** One student: an existing student account, or a phone number or email (an invitation when unknown). */
export class EnrolStudentDto {
  @ApiPropertyOptional({ description: 'An existing student account' })
  @IsOptional()
  @IsUUID()
  student_id?: string;

  @ApiPropertyOptional({ example: 'student@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '01XXXXXXXXX' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  phone?: string;

  @ApiPropertyOptional({ example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  roll_no?: string;
}

export class UpdateEnrolmentDto {
  @ApiPropertyOptional({ description: 'Another section of the same class and session' })
  @IsOptional()
  @IsUUID()
  section_id?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(20)
  roll_no?: string | null;

  @ApiPropertyOptional({ enum: [EnrolmentStatusEnum.LEFT], description: 'LEFT removes the student (the row is kept)' })
  @IsOptional()
  @IsIn([EnrolmentStatusEnum.LEFT])
  status?: EnrolmentStatusEnum.LEFT;
}
