import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PaymentEntity } from 'src/modules/payment/entities/payment.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { NotificationOutboxEntity } from './notification-outbox.entity';

export enum SmsCreditBucketEnum {
  /** The plan's monthly allowance; what is left expires at the start of the next month. */
  ALLOWANCE = 'ALLOWANCE',
  /** Bought or added by a platform admin; carries over until used. */
  TOPUP = 'TOPUP',
}

export enum SmsCreditReasonEnum {
  MONTHLY_GRANT = 'MONTHLY_GRANT',
  MONTHLY_EXPIRE = 'MONTHLY_EXPIRE',
  TOPUP = 'TOPUP',
  SEND = 'SEND',
  REFUND = 'REFUND',
  ADJUST = 'ADJUST',
}

/**
 * Every change to an organisation's SMS credits (FND-13, design §8.6). Append-only. The balance of
 * a bucket is the `balance_after` of its newest row; rows are written by SmsCreditsService under a
 * per-organisation lock. The unique keys make the monthly grant, a payment's top-up and a message's
 * charge or refund happen at most once.
 */
@Entity('sms_credit_ledger')
@Index('IDX_sms_credit_ledger_organization_bucket', ['organization_id', 'bucket', 'id'])
@Index('UQ_sms_credit_ledger_period', ['organization_id', 'bucket', 'reason', 'period'], {
  unique: true,
  where: '"period" IS NOT NULL',
})
@Index('UQ_sms_credit_ledger_outbox', ['outbox_id', 'bucket', 'reason'], { unique: true, where: '"outbox_id" IS NOT NULL' })
@Index('UQ_sms_credit_ledger_payment', ['payment_id'], { unique: true, where: '"payment_id" IS NOT NULL' })
@Check('CHK_sms_credit_ledger_bucket', `"bucket" IN ('ALLOWANCE', 'TOPUP')`)
@Check(
  'CHK_sms_credit_ledger_reason',
  `"reason" IN ('MONTHLY_GRANT', 'MONTHLY_EXPIRE', 'TOPUP', 'SEND', 'REFUND', 'ADJUST')`,
)
export class SmsCreditLedgerEntity {
  @ApiProperty({ description: 'bigint, returned as a string' })
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ApiProperty({ enum: SmsCreditBucketEnum })
  @Column({ name: 'bucket', type: 'varchar', length: 10 })
  bucket: SmsCreditBucketEnum;

  @ApiProperty({ enum: SmsCreditReasonEnum })
  @Column({ name: 'reason', type: 'varchar', length: 20 })
  reason: SmsCreditReasonEnum;

  @ApiProperty({ description: '+ grant / top-up / refund, − send / expiry' })
  @Column({ name: 'delta', type: 'int' })
  delta: number;

  @ApiProperty({ description: "The bucket's balance after this row" })
  @Column({ name: 'balance_after', type: 'int' })
  balance_after: number;

  @ApiPropertyOptional({ description: 'YYYY-MM in the organisation time zone (monthly grant and expiry)' })
  @Column({ name: 'period', type: 'varchar', length: 7, nullable: true })
  period: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'outbox_id', type: 'uuid', nullable: true })
  outbox_id: string | null;

  @ManyToOne(() => NotificationOutboxEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'outbox_id' })
  outbox?: NotificationOutboxEntity;

  @ApiPropertyOptional()
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  payment_id: string | null;

  @ManyToOne(() => PaymentEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment?: PaymentEntity;

  @ApiPropertyOptional({ description: "A platform admin's reason for a top-up" })
  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;
}
