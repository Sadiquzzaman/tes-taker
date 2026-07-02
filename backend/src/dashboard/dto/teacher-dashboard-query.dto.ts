import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum DashboardActivityPeriodEnum {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily',
}

export class TeacherDashboardQueryDto {
  @ApiPropertyOptional({
    enum: DashboardActivityPeriodEnum,
    default: DashboardActivityPeriodEnum.MONTHLY,
  })
  @IsOptional()
  @IsEnum(DashboardActivityPeriodEnum)
  activity_period?: DashboardActivityPeriodEnum = DashboardActivityPeriodEnum.MONTHLY;

  @ApiPropertyOptional({ description: 'Calendar year (defaults to current year)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  calendar_year?: number;

  @ApiPropertyOptional({ description: 'Calendar month 1-12 (defaults to current month)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  calendar_month?: number;
}
