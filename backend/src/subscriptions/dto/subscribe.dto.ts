import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { BillingCycleEnum, SubscriptionPlanTypeEnum } from '../entities/subscription-plan.entity';
import { PaymentMethodEnum } from '../entities/payment-history.entity';

export class SubscribeDto {
  @ApiProperty({
    description: 'Plan type to subscribe to',
    enum: SubscriptionPlanTypeEnum,
    example: SubscriptionPlanTypeEnum.PREMIUM,
  })
  @IsEnum(SubscriptionPlanTypeEnum, { message: 'Invalid plan type' })
  @IsNotEmpty()
  plan_type: SubscriptionPlanTypeEnum;

  @ApiProperty({
    description: 'Billing cycle',
    enum: BillingCycleEnum,
    example: BillingCycleEnum.MONTHLY,
  })
  @IsEnum(BillingCycleEnum, { message: 'Invalid billing cycle' })
  @IsNotEmpty()
  billing_cycle: BillingCycleEnum;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.BKASH,
  })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional({
    description: 'Transaction ID from payment gateway',
    example: 'TXN123456789',
  })
  @IsOptional()
  @IsString()
  transaction_id?: string;
}

export class AdminAssignSubscriptionDto {
  @ApiProperty({
    description: 'Teacher ID to assign subscription to',
    example: 'uuid-teacher-id',
  })
  @IsUUID('4', { message: 'Teacher ID must be a valid UUID' })
  @IsNotEmpty()
  teacher_id: string;

  @ApiProperty({
    description: 'Plan type to assign',
    enum: SubscriptionPlanTypeEnum,
    example: SubscriptionPlanTypeEnum.PREMIUM,
  })
  @IsEnum(SubscriptionPlanTypeEnum, { message: 'Invalid plan type' })
  @IsNotEmpty()
  plan_type: SubscriptionPlanTypeEnum;

  @ApiPropertyOptional({
    description: 'Billing cycle (optional for admin assignment)',
    enum: BillingCycleEnum,
    example: BillingCycleEnum.MONTHLY,
  })
  @IsOptional()
  @IsEnum(BillingCycleEnum)
  billing_cycle?: BillingCycleEnum;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: PaymentMethodEnum,
    example: PaymentMethodEnum.MANUAL,
  })
  @IsOptional()
  @IsEnum(PaymentMethodEnum)
  payment_method?: PaymentMethodEnum;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Complimentary subscription for beta tester',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
