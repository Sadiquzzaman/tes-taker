import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from 'src/user/entities/user.entity';
import { TeacherSubscriptionEntity } from './teacher-subscription.entity';
import { SubscriptionPlanTypeEnum, BillingCycleEnum } from './subscription-plan.entity';

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethodEnum {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  ROCKET = 'ROCKET',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MANUAL = 'MANUAL',
}

@Entity('payment_history')
export class PaymentHistoryEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Teacher ID' })
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @ApiProperty({ description: 'Subscription ID' })
  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscription_id?: string;

  @ManyToOne(() => TeacherSubscriptionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subscription_id' })
  subscription?: TeacherSubscriptionEntity;

  @ApiProperty({ description: 'Plan type purchased', enum: SubscriptionPlanTypeEnum })
  @Column({ name: 'plan_type', type: 'enum', enum: SubscriptionPlanTypeEnum })
  plan_type: SubscriptionPlanTypeEnum;

  @ApiProperty({ description: 'Billing cycle', enum: BillingCycleEnum })
  @Column({ name: 'billing_cycle', type: 'enum', enum: BillingCycleEnum, nullable: true })
  billing_cycle?: BillingCycleEnum;

  @ApiProperty({ description: 'Amount in BDT' })
  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: PaymentStatusEnum, default: PaymentStatusEnum.PENDING })
  status: PaymentStatusEnum;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethodEnum })
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethodEnum, nullable: true })
  payment_method?: PaymentMethodEnum;

  @ApiProperty({ description: 'Transaction ID from payment gateway' })
  @Column({ name: 'transaction_id', type: 'varchar', length: 255, nullable: true })
  transaction_id?: string;

  @ApiProperty({ description: 'Payment gateway reference' })
  @Column({ name: 'gateway_reference', type: 'varchar', length: 255, nullable: true })
  gateway_reference?: string;

  @ApiProperty({ description: 'Payment date' })
  @Column({ name: 'payment_date', type: 'timestamp', nullable: true })
  payment_date?: Date;

  @ApiProperty({ description: 'Additional notes' })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string;
}
