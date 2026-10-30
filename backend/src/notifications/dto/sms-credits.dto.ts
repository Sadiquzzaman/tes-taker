import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SMS_TOP_UP_PACKS } from '../sms-top-up-packs';

/** A platform admin adds top-up credits to an organisation (FND-13). */
export class AdminSmsTopUpDto {
  @ApiProperty({ example: 500, minimum: 1, maximum: 1_000_000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  credits: number;

  @ApiPropertyOptional({ description: 'Why (shown in the audit log)', example: 'Paid by bank transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/** The owner buys a pack; the price is the server's (sms-top-up-packs.ts). */
export class BuySmsTopUpDto {
  @ApiProperty({ enum: SMS_TOP_UP_PACKS.map((pack) => pack.id) })
  @IsString()
  @IsIn(SMS_TOP_UP_PACKS.map((pack) => pack.id))
  packId: string;
}
