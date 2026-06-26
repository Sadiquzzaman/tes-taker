import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * Verification can be requested by val_id (preferred, returned by the gateway)
 * or by our own transactionId (tran_id). At least one must be present.
 */
export class VerifyPaymentDto {
  @ApiPropertyOptional({ description: 'SSLCommerz validation id', example: 'sandbox_val_123' })
  @ValidateIf((dto: VerifyPaymentDto) => !dto.transactionId)
  @IsString()
  val_id?: string;

  @ApiPropertyOptional({ description: 'Our transaction id (tran_id)', example: 'TT_lz3k_8f21' })
  @ValidateIf((dto: VerifyPaymentDto) => !dto.val_id)
  @IsString()
  transactionId?: string;
}
