import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class CreateIeltsAssignmentDto {
  @ApiProperty({ description: 'The batch (section)' })
  @IsUUID()
  section_id: string;

  @ApiProperty({ example: '2026-11-20T09:00:00Z' })
  @IsDateString()
  opens_at: string;

  @ApiProperty({ example: '2026-11-20T13:00:00Z' })
  @IsDateString()
  closes_at: string;
}

export class UpdateIeltsAssignmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  opens_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closes_at?: string;
}

export class IeltsAnswerInputDto {
  @ApiPropertyOptional({ description: 'Listening / Reading: the question' })
  @IsOptional()
  @IsUUID()
  question_id?: string;

  @ApiPropertyOptional({ description: 'Writing: the task (part) the script is for' })
  @IsOptional()
  @IsUUID()
  part_id?: string;

  @ApiProperty({ nullable: true, example: 'Sea Road', description: 'The text written, the chosen key(s) "B" or "B,D", or a Writing script; empty clears it' })
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  answer: string | null;
}

export class SaveIeltsAnswersDto {
  @ApiProperty({ type: [IeltsAnswerInputDto] })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => IeltsAnswerInputDto)
  answers: IeltsAnswerInputDto[];
}

export class SubmitIeltsAttemptDto {
  @ApiPropertyOptional({ type: [IeltsAnswerInputDto], description: 'Last answers, saved before marking' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => IeltsAnswerInputDto)
  answers?: IeltsAnswerInputDto[];
}
