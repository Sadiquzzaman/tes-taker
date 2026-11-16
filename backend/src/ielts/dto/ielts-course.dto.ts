import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { IeltsModuleEnum } from '../entities/ielts-profile.entity';

/** A new IELTS course (P12-04, IEL-13). */
export class CreateIeltsCourseDto {
  @ApiPropertyOptional({ example: 'Band 7 Academic — Jan 2027, evening', maxLength: 150 })
  @IsString()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Left out: the main branch (a branch manager's courses are always in their branch)" })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: '2027-01-05' })
  @IsDateString({ strict: true })
  start_date: string;

  @ApiPropertyOptional({ example: '2027-03-31' })
  @IsDateString({ strict: true })
  end_date: string;

  @ApiPropertyOptional({ enum: IeltsModuleEnum, isArray: true })
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(IeltsModuleEnum, { each: true })
  modules: IeltsModuleEnum[];

  @ApiPropertyOptional({ description: 'Seats; left out or null = no limit', minimum: 1, maximum: 1000 })
  @IsOptional()
  @ValidateIf((o) => o.seat_limit !== null)
  @IsInt()
  @Min(1)
  @Max(1000)
  seat_limit?: number | null;

  @ApiPropertyOptional({ description: 'Teachers per module: {"WRITING": ["<user id>", …]}' })
  @IsOptional()
  @IsObject()
  teachers?: Partial<Record<IeltsModuleEnum, string[]>>;
}

/** Changes to a course; every field optional. */
export class UpdateIeltsCourseDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  end_date?: string;

  @ApiPropertyOptional({ enum: IeltsModuleEnum, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsEnum(IeltsModuleEnum, { each: true })
  modules?: IeltsModuleEnum[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.seat_limit !== null)
  @IsInt()
  @Min(1)
  @Max(1000)
  seat_limit?: number | null;

  @ApiPropertyOptional({ description: 'Teachers per module; a module left out keeps its teachers' })
  @IsOptional()
  @IsObject()
  teachers?: Partial<Record<IeltsModuleEnum, string[]>>;
}

export class ListIeltsCoursesQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;
}
