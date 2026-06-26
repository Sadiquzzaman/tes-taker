import { Column, Entity } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanFeatures, PlanLimits } from '../constants/feature-catalog';

/** @deprecated Kept for DB back-compat only — do not use in business logic */
export enum SubscriptionPlanTypeEnum {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  PRO = 'PRO',
}

export enum BillingCycleEnum {
  MONTHLY = 'MONTHLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY = 'YEARLY',
}

export enum PlanVisibilityEnum {
  PUBLIC = 'public',
  HIDDEN = 'hidden',
  BETA = 'beta',
}

@Entity('subscription_plans')
export class SubscriptionPlanEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Display name', example: 'Premium' })
  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @ApiProperty({ description: 'Unique slug', example: 'premium' })
  @Column({ name: 'slug', type: 'varchar', length: 100, unique: true })
  slug: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @ApiPropertyOptional({ description: 'Legacy plan type — nullable, unused in logic' })
  @Column({
    name: 'plan_type',
    type: 'enum',
    enum: SubscriptionPlanTypeEnum,
    nullable: true,
  })
  plan_type?: SubscriptionPlanTypeEnum | null;

  /** Back-compat alias */
  get display_name(): string {
    return this.name;
  }

  @ApiProperty({ description: 'Monthly price in BDT', example: 300 })
  @Column({ name: 'price_monthly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_monthly: number;

  @ApiProperty({ description: 'Half-yearly price in BDT', example: 1650 })
  @Column({ name: 'price_half_yearly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_half_yearly: number;

  @ApiProperty({ description: 'Yearly price in BDT', example: 3000 })
  @Column({ name: 'price_yearly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_yearly: number;

  @ApiProperty({ description: 'Feature flags keyed by catalog' })
  @Column({ name: 'features', type: 'jsonb', default: {} })
  features: PlanFeatures;

  @ApiProperty({ description: 'Limit values keyed by catalog' })
  @Column({ name: 'limits', type: 'jsonb', default: {} })
  limits: PlanLimits;

  @ApiProperty({ description: 'Whether the plan is active' })
  @Column({ name: 'is_plan_active', type: 'boolean', default: true })
  is_plan_active: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @ApiProperty({ description: 'Custom plan for specific customers' })
  @Column({ name: 'is_custom', type: 'boolean', default: false })
  is_custom: boolean;

  @ApiProperty({ description: 'Plan visibility', enum: PlanVisibilityEnum })
  @Column({
    name: 'visibility',
    type: 'enum',
    enum: PlanVisibilityEnum,
    default: PlanVisibilityEnum.PUBLIC,
  })
  visibility: PlanVisibilityEnum;
}
