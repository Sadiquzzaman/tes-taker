import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAcademicSessionDto {
  @ApiProperty({ example: '2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '2027-01-01' })
  @IsDateString({ strict: true })
  start_date: string;

  @ApiProperty({ example: '2027-12-31' })
  @IsDateString({ strict: true })
  end_date: string;

  @ApiPropertyOptional({ description: 'Make it the default session' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateAcademicSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  end_date?: string;
}

export class CreateTermDto {
  @ApiProperty({ example: 'Half-yearly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  end_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}

export class UpdateTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  start_date?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  end_date?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
