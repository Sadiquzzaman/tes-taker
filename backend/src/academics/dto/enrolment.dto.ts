import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
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

  @ApiPropertyOptional({ description: "The student's name, kept on an invitation until they sign up" })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;
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

/** FND-05: move the chosen students of a section into a section of another session. */
export class PromoteStudentsDto {
  @ApiProperty({ description: 'The section in the next session (any class)' })
  @IsUUID()
  target_section_id: string;

  @ApiProperty({ type: [String], description: 'Enrolments of this section to move; students left out stay (held back or leaving)' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  enrolment_ids: string[];
}
