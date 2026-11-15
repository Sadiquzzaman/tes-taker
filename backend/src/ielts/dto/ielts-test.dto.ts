import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { IeltsModuleEnum, IeltsTestTypeEnum } from '../entities/ielts-profile.entity';
import { IeltsTestPurposeEnum, IeltsTestStatusEnum } from '../entities/ielts-test.entity';

export class CreateIeltsTestDto {
  @ApiProperty({ example: 'Mock test 3' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: IeltsTestTypeEnum })
  @IsEnum(IeltsTestTypeEnum)
  test_type: IeltsTestTypeEnum;

  @ApiProperty({ enum: IeltsTestPurposeEnum, description: 'MOCK: the real template; PRACTICE: chosen parts of one module' })
  @IsEnum(IeltsTestPurposeEnum)
  purpose: IeltsTestPurposeEnum;

  @ApiPropertyOptional({ enum: IeltsModuleEnum, isArray: true, description: 'MOCK: the modules included (default all four)' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(IeltsModuleEnum, { each: true })
  modules?: IeltsModuleEnum[];

  @ApiPropertyOptional({ enum: IeltsModuleEnum, description: 'PRACTICE: the module' })
  @IsOptional()
  @IsEnum(IeltsModuleEnum)
  module?: IeltsModuleEnum;

  @ApiPropertyOptional({ example: [2], description: 'PRACTICE: the parts, passages or tasks included' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsInt({ each: true })
  part_nos?: number[];
}

export class UpdateIeltsTestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: IeltsTestTypeEnum, description: 'Drafts only' })
  @IsOptional()
  @IsEnum(IeltsTestTypeEnum)
  test_type?: IeltsTestTypeEnum;

  @ApiPropertyOptional({ example: { LISTENING: 1800 }, description: 'Drafts only: seconds per included module (1 minute to 3 hours)' })
  @IsOptional()
  @IsObject()
  durations?: Partial<Record<IeltsModuleEnum, number>>;
}

export class ListIeltsTestsQueryDto {
  @ApiPropertyOptional({ enum: IeltsTestStatusEnum })
  @IsOptional()
  @IsEnum(IeltsTestStatusEnum)
  status?: IeltsTestStatusEnum;

  @ApiPropertyOptional({ enum: IeltsTestPurposeEnum })
  @IsOptional()
  @IsEnum(IeltsTestPurposeEnum)
  purpose?: IeltsTestPurposeEnum;
}

export class UpdateIeltsTestPartDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Reading passage, Writing task, Speaking questions or cue card (rich text)' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  content?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Listening: the part’s recording (an IELTS upload, audio, up to 20 MB)' })
  @IsOptional()
  @IsUUID()
  audio_file_id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Reading or Writing: a picture (Writing Task 1 chart, map, diagram)' })
  @IsOptional()
  @IsUUID()
  image_file_id?: string | null;
}

