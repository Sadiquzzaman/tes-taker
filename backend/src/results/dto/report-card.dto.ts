import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class ReportCardsQueryDto {
  @ApiProperty()
  @IsUUID()
  section_id: string;

  @ApiPropertyOptional({ description: 'A term of the section’s session; the whole session if none is given' })
  @IsOptional()
  @IsUUID()
  term_id?: string;
}

export class ReportCardRowDto {
  @ApiProperty()
  @IsUUID()
  student_id: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  teacher_remark?: string | null;

  @ApiPropertyOptional({ maxLength: 500, description: 'Owners and admins only; kept as it was for others' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  principal_remark?: string | null;
}

/** Make (or make again) the report cards of some students of a section for a term (PRF-09). */
export class GenerateReportCardsDto extends ReportCardsQueryDto {
  @ApiProperty({ enum: ['bn', 'en'] })
  @IsIn(['bn', 'en'])
  locale: 'bn' | 'en';

  @ApiProperty({ type: [ReportCardRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReportCardRowDto)
  rows: ReportCardRowDto[];
}
