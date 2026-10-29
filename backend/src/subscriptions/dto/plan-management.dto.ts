import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingCycleEnum, PlanVisibilityEnum } from '../entities/subscription-plan.entity';
import { PaymentMethodEnum } from '../entities/payment-history.entity';

export class CreatePlanDto {
  @ApiProperty({ example: 'Enterprise' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'enterprise' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_monthly?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_half_yearly?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_yearly?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'boolean' } })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @ApiPropertyOptional({ enum: PlanVisibilityEnum })
  @IsOptional()
  @IsEnum(PlanVisibilityEnum)
  visibility?: PlanVisibilityEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_custom?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class UpdatePlanDto extends CreatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_plan_active?: boolean;
}

export class ReorderPlansDto {
  @ApiProperty({ type: [String], description: 'Ordered plan IDs' })
  @IsUUID('4', { each: true })
  plan_ids: string[];
}

/** Assign a plan to an organisation, or (legacy) to a teacher, meaning their SOLO organisation. Give one. */
export class AssignPlanDto {
  @ApiPropertyOptional({ description: 'Organisation to assign the plan to' })
  @IsOptional()
  @IsUUID('4')
  organization_id?: string;

  @ApiPropertyOptional({ description: 'Legacy: a teacher; the plan goes to their SOLO organisation' })
  @IsOptional()
  @IsUUID('4')
  teacher_id?: string;

  @ApiProperty()
  @IsUUID('4')
  plan_id: string;

  @ApiPropertyOptional({ enum: BillingCycleEnum })
  @IsOptional()
  @IsEnum(BillingCycleEnum)
  billing_cycle?: BillingCycleEnum;

  @ApiPropertyOptional({ enum: PaymentMethodEnum })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChangePlanDto {
  @ApiProperty()
  @IsUUID('4')
  plan_id: string;

  @ApiProperty({ enum: BillingCycleEnum })
  @IsEnum(BillingCycleEnum)
  billing_cycle: BillingCycleEnum;

  @ApiPropertyOptional({ enum: PaymentMethodEnum })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;
}

export class SubscriptionOverridesDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'boolean' } })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'number' } })
  @IsOptional()
  @IsObject()
  limits?: Record<string, number>;

  @ApiPropertyOptional({ description: 'ISO date when overrides expire' })
  @IsOptional()
  @IsString()
  expires_at?: string;
}

export class GrantTempAccessDto extends SubscriptionOverridesDto {
  @ApiPropertyOptional({ description: 'Organisation to grant access to' })
  @IsOptional()
  @IsUUID('4')
  organization_id?: string;

  @ApiPropertyOptional({ description: 'Legacy: a teacher; access goes to their SOLO organisation' })
  @IsOptional()
  @IsUUID('4')
  teacher_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  plan_id?: string;
}

export class SubscribeByPlanIdDto {
  @ApiProperty()
  @IsUUID('4')
  plan_id: string;

  @ApiProperty({ enum: BillingCycleEnum })
  @IsEnum(BillingCycleEnum)
  billing_cycle: BillingCycleEnum;

  @ApiPropertyOptional({ enum: PaymentMethodEnum })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transaction_id?: string;
}

export class SetTeacherActiveDto {
  @ApiProperty({ description: 'Whether the teacher account is active and can log in' })
  @IsBoolean()
  active: boolean;
}

/** A platform admin's switch for one feature or limit of one organisation (FND-07). */
export class SetFeatureOverrideDto {
  @ApiProperty({ description: 'true/false for a feature, a number for a limit (0 = no limit)' })
  @IsNotEmpty()
  value: boolean | number;

  @ApiPropertyOptional({ description: 'ISO date; the override stops counting after it' })
  @IsOptional()
  @IsString()
  expires_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** "Request this feature" from the More features page (FND-08). */
export class CreateFeatureRequestDto {
  @ApiProperty({ description: 'Feature key from the catalog' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  feature_key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
