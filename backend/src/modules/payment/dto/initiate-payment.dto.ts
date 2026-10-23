import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * The client only says which PENDING subscription to pay for.
 * Amount, currency, customer and plan details are all read on the server;
 * any other field sent by the browser is stripped by the global ValidationPipe.
 */
export class InitiatePaymentDto {
  @ApiProperty({ description: 'Pending subscription UUID owned by the caller' })
  @IsUUID()
  @IsNotEmpty()
  subscriptionId: string;
}
