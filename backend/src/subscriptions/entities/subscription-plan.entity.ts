import { Column, Entity } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

@Entity('subscription_plans')
export class SubscriptionPlanEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Plan type', enum: SubscriptionPlanTypeEnum })
  @Column({ name: 'plan_type', type: 'enum', enum: SubscriptionPlanTypeEnum, unique: true })
  plan_type: SubscriptionPlanTypeEnum;

  @ApiProperty({ description: 'Display name of the plan', example: 'Premium Plan' })
  @Column({ name: 'display_name', type: 'varchar', length: 50 })
  display_name: string;

  @ApiProperty({ description: 'Plan description' })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  // Pricing in BDT
  @ApiProperty({ description: 'Monthly price in BDT', example: 300 })
  @Column({ name: 'price_monthly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_monthly: number;

  @ApiProperty({ description: 'Half-yearly price in BDT', example: 1650 })
  @Column({ name: 'price_half_yearly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_half_yearly: number;

  @ApiProperty({ description: 'Yearly price in BDT', example: 3000 })
  @Column({ name: 'price_yearly', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_yearly: number;

  // Feature limits
  @ApiProperty({ description: 'Maximum students per exam', example: 80 })
  @Column({ name: 'max_students_per_exam', type: 'int', default: 20 })
  max_students_per_exam: number;

  @ApiProperty({ description: 'Maximum exams per month (0 for unlimited)', example: 15 })
  @Column({ name: 'max_exams_per_month', type: 'int', default: 5 })
  max_exams_per_month: number;

  @ApiProperty({ description: 'Maximum total exams (0 for unlimited)', example: 0 })
  @Column({ name: 'max_total_exams', type: 'int', default: 5 })
  max_total_exams: number;

  // Feature flags
  @ApiProperty({ description: 'Whether subjective exams are allowed' })
  @Column({ name: 'allows_subjective_exams', type: 'boolean', default: false })
  allows_subjective_exams: boolean;

  @ApiProperty({ description: 'Whether images in questions are allowed' })
  @Column({ name: 'allows_images_in_questions', type: 'boolean', default: false })
  allows_images_in_questions: boolean;

  @ApiProperty({ description: 'Whether graphical analytics is available' })
  @Column({ name: 'has_graphical_analytics', type: 'boolean', default: false })
  has_graphical_analytics: boolean;

  @ApiProperty({ description: 'Whether student performance graphs are available' })
  @Column({ name: 'has_performance_graphs', type: 'boolean', default: false })
  has_performance_graphs: boolean;

  // Tracking features
  @ApiProperty({ description: 'Whether browser change tracking is enabled' })
  @Column({ name: 'has_browser_tracking', type: 'boolean', default: false })
  has_browser_tracking: boolean;

  @ApiProperty({ description: 'Whether tab switch tracking is enabled' })
  @Column({ name: 'has_tab_tracking', type: 'boolean', default: false })
  has_tab_tracking: boolean;

  @ApiProperty({ description: 'Whether video proctoring is enabled' })
  @Column({ name: 'has_video_proctoring', type: 'boolean', default: false })
  has_video_proctoring: boolean;

  @ApiProperty({ description: 'Whether auto-disqualification is enabled' })
  @Column({ name: 'has_auto_disqualify', type: 'boolean', default: false })
  has_auto_disqualify: boolean;

  @ApiProperty({ description: 'Whether push notifications are enabled' })
  @Column({ name: 'has_push_notifications', type: 'boolean', default: false })
  has_push_notifications: boolean;

  @ApiProperty({ description: 'Whether the plan is active' })
  @Column({ name: 'is_plan_active', type: 'boolean', default: true })
  is_plan_active: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;
}
