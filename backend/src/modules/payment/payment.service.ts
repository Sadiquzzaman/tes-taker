import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentStatusEnum } from './enums/payment-status.enum';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  SslCallbackPayload,
  SslCommerzConfig,
  SslSessionResponse,
  SslValidationResponse,
} from './interfaces/sslcommerz.interface';
import { SubscriptionService } from 'src/subscriptions/subscription.service';

const SUCCESSFUL_VALIDATION_STATUSES = ['VALID', 'VALIDATED'];
const HTTP_TIMEOUT_MS = 20000;
const AMOUNT_TOLERANCE = 0.01;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async initiatePayment(dto: InitiatePaymentDto): Promise<{
    paymentId: string;
    orderId: string;
    transactionId: string;
    amount: number;
    currency: string;
    gatewayPageUrl: string;
  }> {
    const config = this.getConfig();
    const transactionId = this.generateTransactionId();

    const payment = this.paymentRepo.create({
      orderId: dto.orderId,
      transactionId,
      amount: dto.amount,
      currency: 'BDT',
      status: PaymentStatusEnum.PENDING,
      customerName: dto.customer.name,
      customerEmail: dto.customer.email,
      customerPhone: dto.customer.phone,
      metadata: {
        teacherId: dto.teacherId,
        planId: dto.planId,
        billingCycle: dto.billingCycle,
        subscriptionId: dto.subscriptionId,
      },
    });
    await this.paymentRepo.save(payment);

    this.logger.log(
      `Initiating payment | paymentId=${payment.id} tran_id=${transactionId} orderId=${dto.orderId} amount=${dto.amount}`,
    );

    const body = this.buildSessionPayload(config, dto, transactionId);

    let session: SslSessionResponse;
    try {
      const response = await axios.post<SslSessionResponse>(config.sessionApi, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: HTTP_TIMEOUT_MS,
      });
      session = response.data;
    } catch (error) {
      this.logger.error(
        `SSLCommerz session API call failed | tran_id=${transactionId} error=${this.stringifyError(error)}`,
      );
      payment.status = PaymentStatusEnum.FAILED;
      await this.paymentRepo.save(payment);
      throw new InternalServerErrorException('Failed to reach payment gateway');
    }

    payment.gatewayResponse = session as unknown as Record<string, unknown>;

    if (session.status !== 'SUCCESS' || !session.GatewayPageURL) {
      payment.status = PaymentStatusEnum.FAILED;
      await this.paymentRepo.save(payment);
      this.logger.warn(
        `Gateway session creation rejected | tran_id=${transactionId} reason=${session.failedreason ?? 'unknown'}`,
      );
      throw new BadRequestException(session.failedreason || 'Failed to create payment session');
    }

    await this.paymentRepo.save(payment);

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      transactionId: payment.transactionId,
      amount: Number(payment.amount),
      currency: payment.currency,
      gatewayPageUrl: session.GatewayPageURL,
    };
  }

  /**
   * Verify and settle a payment using the validation API.
   * Idempotent: an already-PAID payment is returned without re-processing.
   */
  async verifyPayment(params: {
    transactionId?: string;
    valId?: string;
  }): Promise<PaymentEntity> {
    const transactionId = await this.resolveTransactionId(params);
    return this.settlePayment(transactionId, params.valId);
  }

  /**
   * Server-to-server IPN handler. Verifies via validation API and settles.
   * Designed to be idempotent so a missed frontend callback is recovered safely.
   */
  async handleIpn(payload: SslCallbackPayload): Promise<{ received: boolean; status: PaymentStatusEnum }> {
    this.logger.log(
      `IPN received | tran_id=${payload.tran_id ?? 'n/a'} val_id=${payload.val_id ?? 'n/a'} status=${payload.status ?? 'n/a'}`,
    );

    if (!payload.tran_id) {
      throw new BadRequestException('tran_id is required');
    }

    const gatewayStatus = (payload.status ?? '').toUpperCase();

    if (payload.val_id && (gatewayStatus === 'VALID' || gatewayStatus === 'VALIDATED' || gatewayStatus === '')) {
      const payment = await this.settlePayment(payload.tran_id, payload.val_id, payload);
      return { received: true, status: payment.status };
    }

    if (gatewayStatus === 'FAILED') {
      const payment = await this.markTerminal(payload.tran_id, PaymentStatusEnum.FAILED, payload);
      return { received: true, status: payment.status };
    }

    if (gatewayStatus === 'CANCELLED') {
      const payment = await this.markTerminal(payload.tran_id, PaymentStatusEnum.CANCELLED, payload);
      return { received: true, status: payment.status };
    }

    // Unknown / incomplete IPN: acknowledge without changing state.
    const existing = await this.paymentRepo.findOne({ where: { transactionId: payload.tran_id } });
    return { received: true, status: existing?.status ?? PaymentStatusEnum.PENDING };
  }

  async handleSuccessCallback(payload: SslCallbackPayload): Promise<PaymentEntity> {
    if (!payload.tran_id) {
      throw new BadRequestException('tran_id is required');
    }
    // Never trust the success callback alone; always confirm through validation API.
    return this.settlePayment(payload.tran_id, payload.val_id, payload);
  }

  async handleFailCallback(payload: SslCallbackPayload): Promise<PaymentEntity> {
    if (!payload.tran_id) {
      throw new BadRequestException('tran_id is required');
    }
    return this.markTerminal(payload.tran_id, PaymentStatusEnum.FAILED, payload);
  }

  async handleCancelCallback(payload: SslCallbackPayload): Promise<PaymentEntity> {
    if (!payload.tran_id) {
      throw new BadRequestException('tran_id is required');
    }
    return this.markTerminal(payload.tran_id, PaymentStatusEnum.CANCELLED, payload);
  }

  async getByTransactionId(transactionId: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepo.findOne({ where: { transactionId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  // ---------------------------------------------------------------------------
  // Core settlement (locked + idempotent)
  // ---------------------------------------------------------------------------

  private async settlePayment(
    transactionId: string,
    valId: string | undefined,
    callbackPayload?: SslCallbackPayload,
  ): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentEntity);
      const payment = await repo.findOne({
        where: { transactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Idempotency: once paid, do not re-process or downgrade.
      if (payment.status === PaymentStatusEnum.PAID) {
        this.logger.log(`Payment already settled | tran_id=${transactionId} (idempotent no-op)`);
        return payment;
      }

      const effectiveValId = valId ?? payment.sslValId ?? undefined;
      if (!effectiveValId) {
        throw new BadRequestException('val_id is required to verify this payment');
      }

      const validation = await this.validateWithGateway(effectiveValId);
      const validationStatus = (validation.status ?? '').toUpperCase();

      if (callbackPayload) {
        payment.gatewayResponse = {
          ...(payment.gatewayResponse ?? {}),
          last_callback: callbackPayload,
        };
      }
      payment.validationResponse = validation as unknown as Record<string, unknown>;
      payment.sslValId = effectiveValId;

      if (!SUCCESSFUL_VALIDATION_STATUSES.includes(validationStatus)) {
        await repo.save(payment);
        this.logger.warn(
          `Validation unsuccessful | tran_id=${transactionId} status=${validationStatus || 'unknown'}`,
        );
        throw new BadRequestException('Payment validation was not successful');
      }

      // Guard against tampering: validated amount must match the recorded amount.
      const validatedAmount = Number(validation.amount);
      const expectedAmount = Number(payment.amount);
      if (
        !Number.isNaN(validatedAmount) &&
        Math.abs(validatedAmount - expectedAmount) > AMOUNT_TOLERANCE
      ) {
        await repo.save(payment);
        this.logger.error(
          `Amount mismatch | tran_id=${transactionId} expected=${expectedAmount} validated=${validatedAmount}`,
        );
        throw new BadRequestException('Payment amount mismatch');
      }

      // Guard against transaction id mismatch from the gateway response.
      if (validation.tran_id && validation.tran_id !== transactionId) {
        await repo.save(payment);
        this.logger.error(
          `Transaction id mismatch | expected=${transactionId} validated=${validation.tran_id}`,
        );
        throw new BadRequestException('Transaction id mismatch');
      }

      payment.status = PaymentStatusEnum.PAID;
      payment.paymentMethod = validation.card_type ?? payment.paymentMethod ?? null;
      await repo.save(payment);

      await this.activateSubscriptionIfNeeded(payment);

      this.logger.log(`Payment settled successfully | tran_id=${transactionId} status=PAID`);
      return payment;
    });
  }

  /**
   * Mark a payment FAILED/CANCELLED. Idempotent and never overrides a PAID payment.
   */
  private async markTerminal(
    transactionId: string,
    status: PaymentStatusEnum.FAILED | PaymentStatusEnum.CANCELLED,
    callbackPayload?: SslCallbackPayload,
  ): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaymentEntity);
      const payment = await repo.findOne({
        where: { transactionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (callbackPayload) {
        payment.gatewayResponse = {
          ...(payment.gatewayResponse ?? {}),
          last_callback: callbackPayload,
        };
      }

      // Do not override a completed payment.
      if (payment.status === PaymentStatusEnum.PAID) {
        await repo.save(payment);
        this.logger.warn(
          `Ignoring ${status} callback for already PAID payment | tran_id=${transactionId}`,
        );
        return payment;
      }

      if (payment.status === PaymentStatusEnum.PENDING) {
        payment.status = status;
      }

      await repo.save(payment);
      this.logger.log(`Payment marked ${payment.status} | tran_id=${transactionId}`);
      return payment;
    });
  }

  private async validateWithGateway(valId: string): Promise<SslValidationResponse> {
    const config = this.getConfig();
    const params = new URLSearchParams({
      val_id: valId,
      store_id: config.storeId,
      store_passwd: config.storePassword,
      format: 'json',
      v: '1',
    });

    try {
      const response = await axios.get<SslValidationResponse>(
        `${config.validationApi}?${params.toString()}`,
        { timeout: HTTP_TIMEOUT_MS },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `SSLCommerz validation API call failed | val_id=${valId} error=${this.stringifyError(error)}`,
      );
      throw new InternalServerErrorException('Failed to reach payment validation service');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveTransactionId(params: {
    transactionId?: string;
    valId?: string;
  }): Promise<string> {
    if (params.transactionId) {
      return params.transactionId;
    }

    if (!params.valId) {
      throw new BadRequestException('Either transactionId or val_id is required');
    }

    // Resolve tran_id from the validation API when only val_id is supplied.
    const validation = await this.validateWithGateway(params.valId);
    if (!validation.tran_id) {
      throw new BadRequestException('Unable to resolve transaction from val_id');
    }
    return validation.tran_id;
  }

  private buildSessionPayload(
    config: SslCommerzConfig,
    dto: InitiatePaymentDto,
    transactionId: string,
  ): URLSearchParams {
    const payload = new URLSearchParams();
    payload.append('store_id', config.storeId);
    payload.append('store_passwd', config.storePassword);
    payload.append('total_amount', Number(dto.amount).toFixed(2));
    payload.append('currency', 'BDT');
    payload.append('tran_id', transactionId);
    payload.append('success_url', `${config.frontendBaseUrl}/payment/success`);
    payload.append('fail_url', `${config.frontendBaseUrl}/payment/fail`);
    payload.append('cancel_url', `${config.frontendBaseUrl}/payment/cancel`);
    payload.append('ipn_url', `${config.backendBaseUrl}/api/v1/payments/ipn`);
    payload.append('cus_name', dto.customer.name);
    payload.append('cus_email', dto.customer.email);
    payload.append('cus_phone', dto.customer.phone);
    payload.append('product_name', dto.productName ?? 'TestTaker Order');
    payload.append('product_category', dto.productCategory ?? 'general');
    payload.append('product_profile', 'general');
    return payload;
  }

  private generateTransactionId(): string {
    const time = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `TT_${time}_${random}`.toUpperCase();
  }

  private getConfig(): SslCommerzConfig {
    const config: SslCommerzConfig = {
      storeId: this.configService.get<string>('SSL_STORE_ID', ''),
      storePassword: this.configService.get<string>('SSL_STORE_PASSWORD', ''),
      sessionApi: this.configService.get<string>('SSL_SESSION_API', ''),
      validationApi: this.configService.get<string>('SSL_VALIDATION_API', ''),
      backendBaseUrl: this.configService.get<string>('BACKEND_BASE_URL', ''),
      frontendBaseUrl: this.configService.get<string>('FRONTEND_BASE_URL', ''),
    };

    const missing = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      this.logger.error(`Missing SSLCommerz configuration: ${missing.join(', ')}`);
      throw new InternalServerErrorException('Payment gateway is not configured');
    }

    return config;
  }

  private async activateSubscriptionIfNeeded(payment: PaymentEntity): Promise<void> {
    const subscriptionId = payment.metadata?.subscriptionId;
    if (!subscriptionId) {
      return;
    }

    try {
      await this.subscriptionService.activateSubscriptionFromPayment(
        subscriptionId,
        payment.transactionId,
        Number(payment.amount),
        payment.sslValId ?? undefined,
      );
      this.logger.log(`Subscription activated | subscriptionId=${subscriptionId} tran_id=${payment.transactionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to activate subscription after payment | subscriptionId=${subscriptionId} error=${this.stringifyError(error)}`,
      );
    }
  }

  private stringifyError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return `${error.code ?? ''} ${error.message}`.trim();
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
