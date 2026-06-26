import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentStatusEnum } from '../enums/payment-status.enum';

@Entity('payments')
export class PaymentEntity {
  @ApiProperty({ description: 'Internal payment UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Caller-supplied order identifier' })
  @Index()
  @Column({ name: 'order_id', type: 'varchar', length: 255 })
  orderId: string;

  @ApiProperty({ description: 'Unique gateway transaction id (tran_id)' })
  @Index({ unique: true })
  @Column({ name: 'transaction_id', type: 'varchar', length: 64, unique: true })
  transactionId: string;

  @ApiProperty({ description: 'Payment amount' })
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @ApiProperty({ description: 'ISO currency code' })
  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'BDT' })
  currency: string;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatusEnum })
  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  status: PaymentStatusEnum;

  @ApiPropertyOptional({ description: 'SSLCommerz validation id (val_id)' })
  @Column({ name: 'ssl_val_id', type: 'varchar', length: 255, nullable: true })
  sslValId: string | null;

  @ApiPropertyOptional({ description: 'Resolved payment method / card type' })
  @Column({ name: 'payment_method', type: 'varchar', length: 100, nullable: true })
  paymentMethod: string | null;

  @ApiPropertyOptional({ description: 'Customer name' })
  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @ApiPropertyOptional({ description: 'Customer email' })
  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail: string | null;

  @ApiPropertyOptional({ description: 'Customer phone' })
  @Column({ name: 'customer_phone', type: 'varchar', length: 32, nullable: true })
  customerPhone: string | null;

  @ApiPropertyOptional({ description: 'Raw session/gateway response for debugging' })
  @Column({ name: 'gateway_response', type: 'jsonb', nullable: true })
  gatewayResponse: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Raw validation response for debugging' })
  @Column({ name: 'validation_response', type: 'jsonb', nullable: true })
  validationResponse: Record<string, unknown> | null;

  @ApiProperty({ description: 'Created timestamp' })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
