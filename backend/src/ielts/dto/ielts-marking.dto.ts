import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { IeltsModuleEnum } from '../entities/ielts-profile.entity';

export class IeltsTaskMarksDto {
  @ApiProperty({ description: 'The Writing task (part)' })
  @IsUUID()
  part_id: string;

  @ApiProperty({ example: { TA: 6, CC: 6.5, LR: 6, GRA: 5.5 }, description: 'Task 1: TA, CC, LR, GRA; Task 2: TR, CC, LR, GRA; 0–9 in half bands' })
  @IsObject()
  criteria: Record<string, number>;

  @ApiPropertyOptional({ example: 'Give an overview of the main trends.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}

export class MarkIeltsWritingDto {
  @ApiProperty({ type: [IeltsTaskMarksDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => IeltsTaskMarksDto)
  tasks: IeltsTaskMarksDto[];

  @ApiPropertyOptional({ description: 'Overall feedback to the student' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string;
}

export class ListIeltsMarkingQueryDto {
  @ApiPropertyOptional({ enum: [IeltsModuleEnum.WRITING, IeltsModuleEnum.SPEAKING] })
  @IsOptional()
  @IsEnum(IeltsModuleEnum)
  module?: IeltsModuleEnum;

  @ApiPropertyOptional({ enum: ['WAITING', 'MARKED'], description: 'Default: waiting to be marked' })
  @IsOptional()
  @IsIn(['WAITING', 'MARKED'])
  state?: 'WAITING' | 'MARKED';
}

export class MarkIeltsSpeakingDto {
  @ApiProperty({ example: { FC: 6, LR: 6.5, GRA: 6, P: 7 }, description: 'Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation; 0–9 in half bands' })
  @IsObject()
  criteria: Record<string, number>;

  @ApiPropertyOptional({ description: "The examiner's notes for the student" })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string;
}

export class StartIeltsSpeakingDto {
  @ApiProperty({ description: 'The student of the batch to examine' })
  @IsUUID()
  student_id: string;
}

export class IeltsRecordingDto {
  @ApiProperty({ description: 'The Speaking part' })
  @IsUUID()
  part_id: string;

  @ApiProperty({ nullable: true, description: 'An IELTS audio upload; null removes the recording' })
  @IsOptional()
  @IsUUID()
  file_id: string | null;
}
