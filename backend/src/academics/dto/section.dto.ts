import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { SectionShiftEnum } from '../entities/section.entity';
import { OfferingEnrolmentModeEnum } from '../entities/course-offering.entity';

export class ListSectionsQueryDto {
  @ApiPropertyOptional({ description: 'Default: the organisation default session' })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

export class CreateSectionDto {
  @ApiProperty({ example: 'B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ description: 'Default: the organisation default session' })
  @IsOptional()
  @IsUUID()
  session_id?: string;

  @ApiPropertyOptional({ enum: SectionShiftEnum })
  @IsOptional()
  @IsEnum(SectionShiftEnum)
  shift?: SectionShiftEnum;

  @ApiPropertyOptional({ example: 'Room 204' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  room?: string;

  @ApiPropertyOptional({ description: 'Only when the organisation has class teachers switched on' })
  @IsOptional()
  @IsUUID()
  class_teacher_id?: string;
}

export class UpdateSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ enum: SectionShiftEnum, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(SectionShiftEnum)
  shift?: SectionShiftEnum | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  room?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null removes the class teacher' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  class_teacher_id?: string | null;
}

export class CreateOfferingDto {
  @ApiProperty()
  @IsUUID()
  subject_id: string;

  @ApiPropertyOptional({ enum: OfferingEnrolmentModeEnum })
  @IsOptional()
  @IsEnum(OfferingEnrolmentModeEnum)
  enrolment_mode?: OfferingEnrolmentModeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;
}

export class UpdateOfferingDto {
  @ApiPropertyOptional({ enum: OfferingEnrolmentModeEnum })
  @IsOptional()
  @IsEnum(OfferingEnrolmentModeEnum)
  enrolment_mode?: OfferingEnrolmentModeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;
}

export class SetOfferingTeachersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  teacher_ids: string[];
}

export class SetOfferingStudentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('all', { each: true })
  student_ids: string[];
}
