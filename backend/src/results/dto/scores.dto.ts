import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class ScoreWeightsQueryDto {
  @ApiPropertyOptional({ description: 'The session; the default session if none is given' })
  @IsOptional()
  @IsUUID()
  session_id?: string;
}

/** A class's weights for a session (PRF-01): whole percent adding up to 100; a part can be 0. */
export class SaveScoreWeightsDto {
  @ApiProperty()
  @IsUUID()
  session_id: string;

  @ApiProperty()
  @IsUUID()
  class_id: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(0)
  @Max(100)
  exams_pct: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(0)
  @Max(100)
  homework_pct: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(0)
  @Max(100)
  attendance_pct: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  @Max(100)
  behaviour_pct: number;
}

class AtRiskDto {
  @ApiProperty({ example: 40, description: 'At risk below this overall score %' })
  @IsInt()
  @Min(0)
  @Max(100)
  score_pct: number;

  @ApiProperty({ example: 75, description: 'At risk below this attendance %' })
  @IsInt()
  @Min(0)
  @Max(100)
  attendance_pct: number;

  @ApiProperty({ example: 3, description: 'At risk with this many missing homework or more (1–50)' })
  @IsInt()
  @Min(1)
  @Max(50)
  missing_homework: number;
}

/** The organisation's performance settings (Epic 3 settings table); owners and admins change them. */
export class UpdatePerformanceSettingsDto {
  @ApiPropertyOptional({ type: AtRiskDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AtRiskDto)
  at_risk?: AtRiskDto;

  @ApiPropertyOptional({ description: 'Students see their merit position' })
  @IsOptional()
  // Keep the raw value: the global implicit conversion would turn the string "false" into true.
  @Transform(({ obj, key }) => (obj as Record<string, unknown>)[key])
  @IsBoolean()
  show_rank?: boolean;
}

export class SectionScoresQueryDto {
  @ApiPropertyOptional({ description: 'A term of the section’s session; the whole session if none is given' })
  @IsOptional()
  @IsUUID()
  term_id?: string;
}

export class StudentScoresQueryDto {
  @ApiPropertyOptional({ description: 'One of the student’s sections (an earlier session for history); their current one if none is given' })
  @IsOptional()
  @IsUUID()
  section_id?: string;

  @ApiPropertyOptional({ description: 'A term of that section’s session; the whole session if none is given' })
  @IsOptional()
  @IsUUID()
  term_id?: string;
}

export class OverviewQueryDto extends ScoreWeightsQueryDto {
  @ApiPropertyOptional({ description: 'A term of the session; the whole session if none is given' })
  @IsOptional()
  @IsUUID()
  term_id?: string;
}
