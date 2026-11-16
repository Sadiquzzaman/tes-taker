import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { IeltsGroupShared, IeltsOption } from '../entities/ielts-question-group.entity';
import { IeltsAnswerKey } from '../entities/ielts-question.entity';
import { IeltsGroupTypeEnum } from '../question-groups';

export class IeltsQuestionInputDto {
  @ApiPropertyOptional({ description: 'An existing question of this group (kept, with its id); leave out for a new one' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ nullable: true, example: 'Why did the writer move?' })
  @IsOptional()
  @IsString()
  prompt?: string | null;

  @ApiPropertyOptional({ nullable: true, example: [{ key: 'A', text: 'For work' }, { key: 'B', text: 'For family' }], description: 'Multiple choice only' })
  @IsOptional()
  @IsArray()
  options?: IeltsOption[] | null;

  @ApiProperty({ example: { accepted: ['colour', 'color'] }, description: '{"accepted": [...]} for written answers, {"keys": [...]} for choices' })
  @IsObject()
  answer: IeltsAnswerKey;
}

export class SaveIeltsGroupDto {
  @ApiProperty({ enum: IeltsGroupTypeEnum })
  @IsEnum(IeltsGroupTypeEnum)
  type: IeltsGroupTypeEnum;

  @ApiProperty({ example: 'Complete the notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.' })
  @IsString()
  instruction: string;

  @ApiPropertyOptional({ nullable: true, example: 2, description: 'Written answers: 1–5 words (numbers do not count)' })
  @IsOptional()
  @IsInt()
  word_limit?: number | null;

  @ApiPropertyOptional({ nullable: true, example: { options: [{ key: 'i', text: 'Early days' }], text: 'The hotel is on [[1]].' } })
  @IsOptional()
  @IsObject()
  shared?: IeltsGroupShared | null;

  @ApiPropertyOptional({ nullable: true, description: 'A map, plan or diagram (an IELTS image upload)' })
  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;

  @ApiProperty({ type: [IeltsQuestionInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => IeltsQuestionInputDto)
  questions: IeltsQuestionInputDto[];
}

export class OrderIeltsGroupsDto {
  @ApiProperty({ description: 'Every live group of the part, in the new order' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  group_ids: string[];
}
