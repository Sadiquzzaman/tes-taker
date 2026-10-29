import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrganizationKindEnum } from '../enums/organization-kind.enum';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';

export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ enum: OrganizationStatusEnum })
  @IsOptional()
  @IsEnum(OrganizationStatusEnum)
  status?: OrganizationStatusEnum;

  @ApiPropertyOptional({
    enum: OrganizationKindEnum,
    description: 'Only this kind. Without it the list has every kind except SOLO (teachers\' own workspaces).',
  })
  @IsOptional()
  @IsEnum(OrganizationKindEnum)
  kind?: OrganizationKindEnum;

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
