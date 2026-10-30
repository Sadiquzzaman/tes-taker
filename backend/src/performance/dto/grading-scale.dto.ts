import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { MAX_GRADE_BANDS, MAX_GRADE_LENGTH } from '../grading-scale.util';

export class GradeBandDto {
  @ApiProperty({ example: 80, description: 'From this percentage (inclusive, up to two decimals)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  min_pct: number;

  @ApiProperty({ example: 100, description: 'To this percentage (inclusive)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  max_pct: number;

  @ApiProperty({ example: 'A+' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_GRADE_LENGTH)
  grade: string;

  @ApiPropertyOptional({ example: 5, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  gpa?: number | null;
}

/** The organisation's bands, replacing the current ones (FND-11). They must cover 0–100% exactly once. */
export class UpdateGradingScaleDto {
  @ApiPropertyOptional({ example: 'English medium' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string;

  @ApiProperty({ type: [GradeBandDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_GRADE_BANDS)
  @ValidateNested({ each: true })
  @Type(() => GradeBandDto)
  bands: GradeBandDto[];
}
