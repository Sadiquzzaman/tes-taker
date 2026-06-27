import { Body, Controller, Get, Logger, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { SslCommerzCallbackDto } from './dto/sslcommerz-callback.dto';
import { SslCallbackPayload } from './interfaces/sslcommerz.interface';

@ApiTags('Payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @ApiOperation({
    summary: 'Initiate a payment',
    description:
      'Creates a PENDING payment, requests an SSLCommerz session, and returns the GatewayPageURL for redirection.',
  })
  @ApiResponse({ status: 201, description: 'Payment session created' })
  async initiate(@Body() dto: InitiatePaymentDto) {
    const payload = await this.paymentService.initiatePayment(dto);
    return { message: 'Payment session created successfully', payload };
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify a payment',
    description:
      'Confirms a payment through the SSLCommerz validation API. Idempotent: a PAID payment is returned unchanged.',
  })
  @ApiResponse({ status: 201, description: 'Payment verified' })
  async verify(@Body() dto: VerifyPaymentDto) {
    const payment = await this.paymentService.verifyPayment({
      transactionId: dto.transactionId,
      valId: dto.val_id,
    });
    return { message: 'Payment verified successfully', payload: payment };
  }

  @Post('ipn')
  @ApiOperation({
    summary: 'SSLCommerz IPN handler',
    description:
      'Server-to-server notification. Verifies via the validation API and reconciles status if the frontend callback was missed. Requires a public URL (ngrok/staging).',
  })
  @ApiResponse({ status: 201, description: 'IPN acknowledged' })
  async ipn(@Body() dto: SslCommerzCallbackDto, @Req() req: Request) {
    const payload = this.mergeCallback(dto, req);
    const result = await this.paymentService.handleIpn(payload);
    return { message: 'IPN processed', payload: result };
  }

  @Post('success')
  @ApiExcludeEndpoint()
  async success(@Body() dto: SslCommerzCallbackDto, @Req() req: Request, @Res() res: Response) {
    const payload = this.mergeCallback(dto, req);
    const frontend = this.paymentService.getFrontendBaseUrl();
    const tranId = encodeURIComponent(payload.tran_id ?? '');

    try {
      const payment = await this.paymentService.handleSuccessCallback(payload);
      this.logger.log(`Success callback settled | tran_id=${payment.transactionId} status=${payment.status}`);
      return res.redirect(`${frontend}/payment/success?tran_id=${encodeURIComponent(payment.transactionId)}`);
    } catch (error) {
      // Validation failed (or amount/tran mismatch): never show a success page.
      this.logger.warn(
        `Success callback rejected | tran_id=${payload.tran_id ?? 'n/a'} error=${error instanceof Error ? error.message : String(error)}`,
      );
      return res.redirect(`${frontend}/payment/fail?tran_id=${tranId}`);
    }
  }

  @Post('fail')
  @ApiExcludeEndpoint()
  async fail(@Body() dto: SslCommerzCallbackDto, @Req() req: Request, @Res() res: Response) {
    const payload = this.mergeCallback(dto, req);
    const frontend = this.paymentService.getFrontendBaseUrl();
    const tranId = encodeURIComponent(payload.tran_id ?? '');

    try {
      await this.paymentService.handleFailCallback(payload);
    } catch (error) {
      this.logger.warn(
        `Fail callback could not update payment | tran_id=${payload.tran_id ?? 'n/a'} error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return res.redirect(`${frontend}/payment/fail?tran_id=${tranId}`);
  }

  @Post('cancel')
  @ApiExcludeEndpoint()
  async cancel(@Body() dto: SslCommerzCallbackDto, @Req() req: Request, @Res() res: Response) {
    const payload = this.mergeCallback(dto, req);
    const frontend = this.paymentService.getFrontendBaseUrl();
    const tranId = encodeURIComponent(payload.tran_id ?? '');

    try {
      await this.paymentService.handleCancelCallback(payload);
    } catch (error) {
      this.logger.warn(
        `Cancel callback could not update payment | tran_id=${payload.tran_id ?? 'n/a'} error=${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return res.redirect(`${frontend}/payment/cancel?tran_id=${tranId}`);
  }

  @Get(':transactionId')
  @ApiOperation({ summary: 'Get payment by transaction id' })
  @ApiParam({ name: 'transactionId', description: 'Gateway transaction id (tran_id)' })
  @ApiResponse({ status: 200, description: 'Payment retrieved' })
  async getByTransactionId(@Param('transactionId') transactionId: string) {
    const payment = await this.paymentService.getByTransactionId(transactionId);
    return { message: 'Payment retrieved successfully', payload: payment };
  }

  /**
   * SSLCommerz sends an urlencoded body. The validated DTO provides typed access
   * to the fields we use, while the raw body preserves every field for storage.
   */
  private mergeCallback(dto: SslCommerzCallbackDto, req: Request): SslCallbackPayload {
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    return { ...rawBody, ...dto };
  }
}
