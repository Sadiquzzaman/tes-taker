import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ enum: OrganizationStatusEnum })
  @IsOptional()
  @IsEnum(OrganizationStatusEnum)
  status?: OrganizationStatusEnum;

  @ApiPropertyOptional({ description: 'Search by organization name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
