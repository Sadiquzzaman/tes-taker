import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength, ValidateNested } from 'class-validator';

export class BehaviourCriterionInputDto {
  @ApiPropertyOptional({ description: 'An existing criterion (to keep or rename it); none for a new one' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'Participation' })
  @IsString()
  @Length(1, 80)
  name_en: string;

  @ApiProperty({ example: 'অংশগ্রহণ' })
  @IsString()
  @Length(1, 80)
  name_bn: string;
}

export class SaveBehaviourCriteriaDto {
  @ApiProperty({ type: [BehaviourCriterionInputDto], description: 'The whole list, in order; criteria left out are retired' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BehaviourCriterionInputDto)
  criteria: BehaviourCriterionInputDto[];
}

export class BehaviourGridQueryDto {
  @ApiProperty()
  @IsUUID()
  offering_id: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString({ strict: true })
  date: string;
}

export class BehaviourRowDto {
  @ApiProperty()
  @IsUUID()
  student_id: string;

  @ApiProperty({ description: 'Rating 1–5 (or null to clear) by criterion id' })
  @IsObject()
  ratings: Record<string, number | null>;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  remark?: string | null;
}

export class SaveBehaviourDto {
  @ApiProperty()
  @IsUUID()
  offering_id: string;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString({ strict: true })
  date: string;

  @ApiProperty({ type: [BehaviourRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BehaviourRowDto)
  rows: BehaviourRowDto[];
}
