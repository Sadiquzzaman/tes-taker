import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PaymentCustomerDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '017xxxxxxxx' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class InitiatePaymentDto {
  @ApiProperty({ example: 'ORDER_123' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 1000, minimum: 1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ type: PaymentCustomerDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentCustomerDto)
  customer: PaymentCustomerDto;

  @ApiProperty({ required: false, example: 'Premium Subscription' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({ required: false, example: 'subscription' })
  @IsOptional()
  @IsString()
  productCategory?: string;

  @ApiPropertyOptional({ description: 'Teacher UUID for subscription checkout' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Plan UUID for subscription checkout' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ description: 'Billing cycle for subscription checkout' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional({ description: 'Pending subscription UUID' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;
}
