import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

/** A register has at most this many lines (students) and columns (roll, name and class days). */
export const MAX_REGISTER_ROWS = 1000;
export const MAX_REGISTER_COLUMNS = 250;
const MAX_CELL = 100;

export class RegisterMonthQueryDto {
  @ApiProperty({ example: '2026-11', description: 'The month, YYYY-MM' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Choose a month as YYYY-MM' })
  month: string;
}

/** One line of the register CSV after the header, cell by cell as the browser read it. */
export class PaperRegisterRowDto {
  @ApiProperty({ type: [String], example: ['1', 'Rahim', 'P', 'L', ''] })
  @IsArray()
  @ArrayMaxSize(MAX_REGISTER_COLUMNS)
  @IsString({ each: true })
  @MaxLength(MAX_CELL, { each: true })
  cells: string[];
}

/**
 * A paper register CSV for one section and month (ATT-17): the header (roll, name and one column
 * per class day) and the lines. The browser reads the file; the server checks every cell.
 */
export class PaperRegisterImportDto extends RegisterMonthQueryDto {
  @ApiProperty({ type: [String], example: ['roll_no', 'name', '2026-11-07', '2026-11-14'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REGISTER_COLUMNS)
  @IsString({ each: true })
  @MaxLength(MAX_CELL, { each: true })
  header: string[];

  @ApiProperty({ type: [PaperRegisterRowDto] })
  @IsArray()
  @ArrayMaxSize(MAX_REGISTER_ROWS)
  @ValidateNested({ each: true })
  @Type(() => PaperRegisterRowDto)
  rows: PaperRegisterRowDto[];

  @ApiPropertyOptional({ description: 'Also replace self check-ins the file disagrees with (listed in the preview); default: keep them' })
  @IsOptional()
  @IsBoolean()
  overwrite_check_ins?: boolean;

  @ApiPropertyOptional({ example: 'class-8-a-2026-11.csv', description: 'Kept in the audit log' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  file_name?: string;
}
