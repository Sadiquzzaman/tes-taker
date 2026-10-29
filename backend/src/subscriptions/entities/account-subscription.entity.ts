import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { SubscriptionPlanEntity, BillingCycleEnum } from './subscription-plan.entity';
import { PlanFeatures, PlanLimits } from '../constants/feature-catalog';

export enum SubscriptionStatusEnum {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
}

/**
 * An organisation's plan (P2-02, FND-07). It replaces teacher_subscriptions (the table was
 * renamed): a solo teacher's plan belongs to their SOLO organisation, a school's to the school.
 * No ACTIVE row means the Free plan.
 */
@Entity('account_subscriptions')
@Index(['organization_id', 'status'])
export class AccountSubscriptionEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Organisation the plan belongs to' })
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ description: 'Subscription plan ID' })
  @Column({ name: 'plan_id', type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => SubscriptionPlanEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlanEntity;

  @ApiPropertyOptional({ description: 'Billing cycle', enum: BillingCycleEnum })
  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycleEnum, nullable: true })
  billing_cycle?: BillingCycleEnum;

  @ApiProperty({ description: 'Price in BDT, computed on the server from the plan when subscribing' })
  @Column({ name: 'price_due', type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_due: number;

  @ApiProperty({ description: 'Amount paid in BDT' })
  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @ApiProperty({ description: 'Subscription status', enum: SubscriptionStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: SubscriptionStatusEnum, default: SubscriptionStatusEnum.ACTIVE })
  status: SubscriptionStatusEnum;

  @ApiProperty({ description: 'Subscription start date' })
  @Column({ name: 'start_date', type: 'timestamp' })
  start_date: Date;

  @ApiPropertyOptional({ description: 'Subscription end date' })
  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  end_date?: Date;

  @ApiPropertyOptional({ description: 'Who subscribed (legacy teacher_subscriptions owner; dropped in the contract step)' })
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacher_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity | null;

  /** @deprecated Replaced by feature_overrides (P2-02); kept read-only for one release. */
  @Column({ name: 'overrides', type: 'jsonb', nullable: true, default: null })
  overrides?: {
    features?: PlanFeatures;
    limits?: PlanLimits;
    expires_at?: string;
  } | null;

  /** @deprecated Usage is counted from exams (EntitlementsService); kept for one release. */
  @Column({ name: 'exams_used_this_month', type: 'int', default: 0 })
  exams_used_this_month: number;

  /** @deprecated See exams_used_this_month. */
  @Column({ name: 'total_exams_used', type: 'int', default: 0 })
  total_exams_used: number;

  /** @deprecated See exams_used_this_month. */
  @Column({ name: 'last_monthly_reset', type: 'timestamp', nullable: true })
  last_monthly_reset?: Date;
}
