import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from 'src/user/entities/user.entity';
import { SubscriptionPlanEntity, BillingCycleEnum, SubscriptionPlanTypeEnum } from './subscription-plan.entity';

export enum SubscriptionStatusEnum {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
}

@Entity('teacher_subscriptions')
export class TeacherSubscriptionEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Teacher ID' })
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @ApiProperty({ description: 'Subscription plan ID' })
  @Column({ name: 'plan_id', type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => SubscriptionPlanEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlanEntity;

  @ApiProperty({ description: 'Plan type at time of subscription', enum: SubscriptionPlanTypeEnum })
  @Column({ name: 'plan_type', type: 'enum', enum: SubscriptionPlanTypeEnum })
  plan_type: SubscriptionPlanTypeEnum;

  @ApiProperty({ description: 'Billing cycle', enum: BillingCycleEnum })
  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycleEnum, nullable: true })
  billing_cycle?: BillingCycleEnum;

  @ApiProperty({ description: 'Amount paid in BDT' })
  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @ApiProperty({ description: 'Subscription status', enum: SubscriptionStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: SubscriptionStatusEnum, default: SubscriptionStatusEnum.ACTIVE })
  status: SubscriptionStatusEnum;

  @ApiProperty({ description: 'Subscription start date' })
  @Column({ name: 'start_date', type: 'timestamp' })
  start_date: Date;

  @ApiProperty({ description: 'Subscription end date' })
  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  end_date?: Date;

  @ApiProperty({ description: 'Number of exams used this month' })
  @Column({ name: 'exams_used_this_month', type: 'int', default: 0 })
  exams_used_this_month: number;

  @ApiProperty({ description: 'Total exams used' })
  @Column({ name: 'total_exams_used', type: 'int', default: 0 })
  total_exams_used: number;

  @ApiProperty({ description: 'Last exam count reset date' })
  @Column({ name: 'last_monthly_reset', type: 'timestamp', nullable: true })
  last_monthly_reset?: Date;
}
