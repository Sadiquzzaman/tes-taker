import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsEnum, IsNotEmpty, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { LEVEL_LABEL_MAX_LENGTH, LevelLabelPresetEnum } from '../level-labels';

export class EnglishLevelNameDto {
  @ApiProperty({ example: 'Course' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LEVEL_LABEL_MAX_LENGTH)
  one: string;

  @ApiProperty({ example: 'Courses' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LEVEL_LABEL_MAX_LENGTH)
  other: string;
}

export class LevelNameDto {
  @ApiProperty({ type: EnglishLevelNameDto })
  @ValidateNested()
  @Type(() => EnglishLevelNameDto)
  en: EnglishLevelNameDto;

  @ApiProperty({ example: 'কোর্স' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(LEVEL_LABEL_MAX_LENGTH)
  bn: string;
}

/** FND-03: a preset, or (CUSTOM) the organisation's own names for both levels. */
export class UpdateLevelLabelsDto {
  @ApiProperty({ enum: LevelLabelPresetEnum })
  @IsEnum(LevelLabelPresetEnum)
  preset: LevelLabelPresetEnum;

  @ApiPropertyOptional({ type: LevelNameDto, description: 'Required for CUSTOM; ignored for presets' })
  @ValidateIf((dto: UpdateLevelLabelsDto) => dto.preset === LevelLabelPresetEnum.CUSTOM)
  @IsDefined()
  @ValidateNested()
  @Type(() => LevelNameDto)
  class?: LevelNameDto;

  @ApiPropertyOptional({ type: LevelNameDto, description: 'Required for CUSTOM; ignored for presets' })
  @ValidateIf((dto: UpdateLevelLabelsDto) => dto.preset === LevelLabelPresetEnum.CUSTOM)
  @IsDefined()
  @ValidateNested()
  @Type(() => LevelNameDto)
  section?: LevelNameDto;
}
