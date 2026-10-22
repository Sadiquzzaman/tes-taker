import { Body, Controller, Get, Logger, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { SslCommerzCallbackDto } from './dto/sslcommerz-callback.dto';
import { SslCallbackPayload } from './interfaces/sslcommerz.interface';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';

@ApiTags('Payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @Throttle({ default: { ttl: 60000, limit: 15 } })
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.TEACHER)
  @ApiOperation({
    summary: 'Initiate a payment',
    description:
      "Creates a PENDING payment for one of the caller's PENDING subscriptions, priced on the server, requests an SSLCommerz session, and returns the GatewayPageURL for redirection.",
  })
  @ApiResponse({ status: 201, description: 'Payment session created' })
  async initiate(@Body() dto: InitiatePaymentDto, @UserPayload() user: JwtPayloadInterface) {
    const payload = await this.paymentService.initiatePayment(dto, user);
    return { message: 'Payment session created successfully', payload };
  }

  @Post('verify')
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Verify a payment',
    description:
      "Confirms one of the caller's payments through the SSLCommerz validation API. Idempotent: a PAID payment is returned unchanged.",
  })
  @ApiResponse({ status: 201, description: 'Payment verified' })
  async verify(@Body() dto: VerifyPaymentDto, @UserPayload() user: JwtPayloadInterface) {
    const payment = await this.paymentService.verifyPayment(
      {
        transactionId: dto.transactionId,
        valId: dto.val_id,
      },
      user.id,
    );
    return { message: 'Payment verified successfully', payload: payment };
  }

  @Post('ipn')
  @SkipThrottle()
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
  @SkipThrottle()
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
  @SkipThrottle()
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
  @SkipThrottle()
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
  @ApiBearerAuth('jwt')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: "Get one of the caller's payments by transaction id" })
  @ApiParam({ name: 'transactionId', description: 'Gateway transaction id (tran_id)' })
  @ApiResponse({ status: 200, description: 'Payment retrieved' })
  @ApiResponse({ status: 404, description: 'Not found or not owned by the caller' })
  async getByTransactionId(
    @Param('transactionId') transactionId: string,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    const payment = await this.paymentService.getByTransactionId(transactionId, user.id);
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
