import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'Platform admin only: one organisation' })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({ description: 'Who did it' })
  @IsOptional()
  @IsUUID()
  actor_id?: string;

  @ApiPropertyOptional({
    description: 'An action (`member.remove`) or an area ending in a dot (`member.`)',
    example: 'subscription.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z_]+(\.[a-z_]*)?$/, { message: 'action must look like area.verb or area.' })
  action?: string;

  @ApiPropertyOptional({ example: 'organization_member' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entity_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entity_id?: string;

  @ApiPropertyOptional({ description: 'From this time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Before this time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

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
