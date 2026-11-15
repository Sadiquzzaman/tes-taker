import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReviewDecisionEnum } from '../entities/similarity-match.entity';
import { SimilarityScopeEnum } from '../entities/similarity-check.entity';

export class IntegrityScopeDto {
  @ApiProperty({ enum: SimilarityScopeEnum })
  @IsEnum(SimilarityScopeEnum)
  scope_type: SimilarityScopeEnum;

  @ApiProperty({ description: 'The homework, or the IELTS opening' })
  @IsUUID()
  scope_id: string;
}

export class ReviewMatchDto {
  @ApiProperty({ enum: ReviewDecisionEnum, description: 'OK: reviewed, fine; COPIED: copied' })
  @IsEnum(ReviewDecisionEnum)
  decision: ReviewDecisionEnum;

  @ApiPropertyOptional({ example: 'Worked together on the outline; asked them to rewrite.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class PlagiarismThresholdsDto {
  @ApiProperty({ example: 40 })
  @IsInt()
  high: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  medium: number;

  @ApiProperty({ example: 50, description: 'Texts with fewer words are not flagged' })
  @IsInt()
  min_words: number;
}
