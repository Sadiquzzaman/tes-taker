import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export const MAX_IMPORT_ROWS = 500;

/**
 * One CSV row as the file has it (FND-04 template). Every cell is optional here: problems are
 * reported per row by the preview instead of failing the whole request.
 */
export class StudentImportRowDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) name?: string;
  @ApiPropertyOptional({ example: '01XXXXXXXXX' }) @IsOptional() @IsString() @MaxLength(200) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) email?: string;
  @ApiPropertyOptional({ description: 'Section name in this class, e.g. A' }) @IsOptional() @IsString() @MaxLength(200) section?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) roll_no?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) guardian1_name?: string;
  @ApiPropertyOptional({ description: 'Father, Mother or Other (also বাবা, মা, অন্যান্য)' }) @IsOptional() @IsString() @MaxLength(200) guardian1_relation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) guardian1_phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) guardian2_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) guardian2_relation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) guardian2_phone?: string;
}

export class StudentImportDto {
  @ApiPropertyOptional({ description: 'The session to enrol into; the default session if left out' })
  @IsOptional()
  @IsUUID()
  session_id?: string;

  @ApiProperty({ type: [StudentImportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => StudentImportRowDto)
  rows: StudentImportRowDto[];

  @ApiPropertyOptional({
    description: 'Invite students without an account: email when given (free), otherwise SMS (uses SMS credits). Off by default.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  send_invitations?: boolean;
}
