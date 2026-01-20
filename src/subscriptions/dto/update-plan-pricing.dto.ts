import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SubscriptionPlanTypeEnum } from '../entities/subscription-plan.entity';

export class UpdatePlanPricingDto {
  @ApiPropertyOptional({
    description: 'Monthly price in BDT',
    example: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Monthly price must be a number' })
  @Min(0, { message: 'Monthly price must be at least 0' })
  price_monthly?: number;

  @ApiPropertyOptional({
    description: 'Half-yearly price in BDT',
    example: 500,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Half-yearly price must be a number' })
  @Min(0, { message: 'Half-yearly price must be at least 0' })
  price_half_yearly?: number;

  @ApiPropertyOptional({
    description: 'Yearly price in BDT',
    example: 1000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Yearly price must be a number' })
  @Min(0, { message: 'Yearly price must be at least 0' })
  price_yearly?: number;
}

export class UpdatePlanFeaturesDto {
  @ApiPropertyOptional({
    description: 'Display name of the plan',
    example: 'Premium Plus',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  display_name?: string;

  @ApiPropertyOptional({
    description: 'Plan description',
    example: 'Enhanced features for power users',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Maximum students per exam',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_students_per_exam?: number;

  @ApiPropertyOptional({
    description: 'Maximum exams per month (0 for unlimited)',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_exams_per_month?: number;

  @ApiPropertyOptional({
    description: 'Maximum total exams (0 for unlimited)',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max_total_exams?: number;

  @ApiPropertyOptional({
    description: 'Whether subjective exams are allowed',
  })
  @IsOptional()
  @IsBoolean()
  allows_subjective_exams?: boolean;

  @ApiPropertyOptional({
    description: 'Whether images in questions are allowed',
  })
  @IsOptional()
  @IsBoolean()
  allows_images_in_questions?: boolean;

  @ApiPropertyOptional({
    description: 'Whether graphical analytics is available',
  })
  @IsOptional()
  @IsBoolean()
  has_graphical_analytics?: boolean;

  @ApiPropertyOptional({
    description: 'Whether student performance graphs are available',
  })
  @IsOptional()
  @IsBoolean()
  has_performance_graphs?: boolean;

  @ApiPropertyOptional({
    description: 'Whether browser change tracking is enabled',
  })
  @IsOptional()
  @IsBoolean()
  has_browser_tracking?: boolean;

  @ApiPropertyOptional({
    description: 'Whether tab switch tracking is enabled',
  })
  @IsOptional()
  @IsBoolean()
  has_tab_tracking?: boolean;

  @ApiPropertyOptional({
    description: 'Whether video proctoring is enabled',
  })
  @IsOptional()
  @IsBoolean()
  has_video_proctoring?: boolean;

  @ApiPropertyOptional({
    description: 'Whether auto-disqualification is enabled',
  })
  @IsOptional()
  @IsBoolean()
  has_auto_disqualify?: boolean;

  @ApiPropertyOptional({
    description: 'Whether push notifications are enabled',
  })
  @IsOptional()
  @IsBoolean()
  has_push_notifications?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the plan is active',
  })
  @IsOptional()
  @IsBoolean()
  is_plan_active?: boolean;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ type: UpdatePlanPricingDto })
  @IsOptional()
  pricing?: UpdatePlanPricingDto;

  @ApiPropertyOptional({ type: UpdatePlanFeaturesDto })
  @IsOptional()
  features?: UpdatePlanFeaturesDto;
}
