import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * SSLCommerz POSTs an application/x-www-form-urlencoded body to the
 * success/fail/cancel/ipn URLs. Only the fields used by the integration are
 * declared; the full raw body is read separately for debugging/storage.
 */
export class SslCommerzCallbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tran_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  val_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  card_type?: string;
}
