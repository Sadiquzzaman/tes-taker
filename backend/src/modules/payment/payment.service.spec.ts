import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import axios from 'axios';
import { PaymentService } from './payment.service';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentStatusEnum } from './enums/payment-status.enum';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SubscriptionService } from 'src/subscriptions/subscription.service';
import { SubscriptionStatusEnum } from 'src/subscriptions/entities/account-subscription.entity';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, default: { ...actual.default, post: jest.fn(), get: jest.fn() } };
});

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * P0-05: the price of a subscription payment comes from the server, the caller
 * must own the subscription/payment, and settlement only activates when the
 * gateway-validated amount and currency match the stored server price.
 */
describe('PaymentService (P0-05 payment security)', () => {
  const OWNER_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '66666666-6666-4666-8666-666666666666';
  /** Checkout pays for the request's workspace (P2-02): run it inside one. */
  const inWorkspace = <T>(work: () => Promise<T>) =>
    TenantContext.run(() => {
      TenantContext.set({ organizationId: ORG_ID, kind: OrganizationKindEnum.SCHOOL, memberRole: OrganizationMemberRoleEnum.OWNER });
      return work();
    });
  const OTHER_ID = '22222222-2222-4222-8222-222222222222';
  const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';
  const PLAN_ID = '44444444-4444-4444-8444-444444444444';
  const PRO_PRICE = 499;

  const owner: JwtPayloadInterface = {
    id: OWNER_ID,
    email: 'owner@example.test',
    full_name: 'Owner Teacher',
    role: 'TEACHER',
    phone: '00000000000',
  };

  const config: Record<string, string> = {
    SSL_STORE_ID: 'test-store',
    SSL_STORE_PASSWORD: 'test-store-password',
    SSL_SESSION_API: 'https://sandbox.example.test/session',
    SSL_VALIDATION_API: 'https://sandbox.example.test/validate',
    BACKEND_BASE_URL: 'https://api.example.test',
    FRONTEND_BASE_URL: 'https://app.example.test',
  };

  let payments: Map<string, PaymentEntity>;
  let paymentRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let subscriptionService: {
    getPendingSubscriptionForPayment: jest.Mock;
    activateSubscriptionFromPayment: jest.Mock;
  };
  let service: PaymentService;

  const pendingSubscription = () => ({
    id: SUBSCRIPTION_ID,
    organization_id: ORG_ID,
    teacher_id: OWNER_ID,
    plan_id: PLAN_ID,
    billing_cycle: 'MONTHLY',
    price_due: PRO_PRICE,
    amount_paid: 0,
    status: SubscriptionStatusEnum.PENDING,
    plan: { name: 'Pro' },
  });

  const seedPayment = (overrides: Partial<PaymentEntity> = {}): PaymentEntity => {
    const payment = {
      id: 'pay-1',
      orderId: `SUB_${SUBSCRIPTION_ID}_1`,
      transactionId: 'TT_TEST_1',
      amount: PRO_PRICE,
      currency: 'BDT',
      status: PaymentStatusEnum.PENDING,
      sslValId: null,
      paymentMethod: null,
      customerName: 'Owner Teacher',
      customerEmail: 'owner@example.test',
      customerPhone: '00000000000',
      gatewayResponse: null,
      validationResponse: null,
      metadata: { teacherId: OWNER_ID, subscriptionId: SUBSCRIPTION_ID, planId: PLAN_ID },
      ...overrides,
    } as PaymentEntity;
    payments.set(payment.transactionId, payment);
    return payment;
  };

  const gatewayValidates = (fields: Record<string, unknown>) => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'VALID', tran_id: 'TT_TEST_1', val_id: 'val-1', card_type: 'VISA', ...fields },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    payments = new Map();
    paymentRepo = {
      create: jest.fn((plain) => ({ id: 'pay-new', ...plain })),
      save: jest.fn(async (entity: PaymentEntity) => {
        payments.set(entity.transactionId, entity);
        return entity;
      }),
      findOne: jest.fn(async ({ where }: { where: { transactionId: string } }) =>
        payments.get(where.transactionId) ?? null,
      ),
    };
    subscriptionService = {
      getPendingSubscriptionForPayment: jest.fn(async (subscriptionId: string, organizationId: string, userId: string) => {
        if (subscriptionId !== SUBSCRIPTION_ID || organizationId !== ORG_ID || userId !== OWNER_ID) {
          throw new NotFoundException('Subscription not found');
        }
        return pendingSubscription();
      }),
      activateSubscriptionFromPayment: jest.fn(async () => ({})),
    };
    const configService = { get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback) };
    const dataSource = {
      transaction: jest.fn(async (work: (manager: unknown) => unknown) =>
        work({ getRepository: () => paymentRepo }),
      ),
    };

    service = new PaymentService(
      paymentRepo as never,
      configService as never,
      dataSource as never,
      subscriptionService as unknown as SubscriptionService,
    );
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      mockedAxios.post.mockResolvedValue({
        data: { status: 'SUCCESS', GatewayPageURL: 'https://sandbox.example.test/pay' },
      });
    });

    it('ignores a client-sent amount and charges the server-side subscription price', async () => {
      const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false });
      const dto = (await pipe.transform(
        { subscriptionId: SUBSCRIPTION_ID, amount: 1, customer: { name: 'x' } },
        { type: 'body', metatype: InitiatePaymentDto },
      )) as InitiatePaymentDto;

      expect(dto).not.toHaveProperty('amount');

      const result = await inWorkspace(() => service.initiatePayment(dto, owner));

      expect(result.amount).toBe(PRO_PRICE);
      expect(subscriptionService.getPendingSubscriptionForPayment).toHaveBeenCalledWith(SUBSCRIPTION_ID, ORG_ID, OWNER_ID);
      const sentBody = new URLSearchParams(mockedAxios.post.mock.calls[0][1] as string);
      expect(sentBody.get('total_amount')).toBe('499.00');
      expect(sentBody.get('currency')).toBe('BDT');

      const stored = payments.get(result.transactionId)!;
      expect(Number(stored.amount)).toBe(PRO_PRICE);
      expect(stored.metadata).toMatchObject({ teacherId: OWNER_ID, subscriptionId: SUBSCRIPTION_ID });
      // The payment records the workspace it pays for and who paid (P2-02).
      expect(stored).toMatchObject({ organizationId: ORG_ID, userId: OWNER_ID, subscriptionId: SUBSCRIPTION_ID, purpose: 'SUBSCRIPTION' });
    });

    it("refuses to initiate a payment for someone else's subscription", async () => {
      const intruder = { ...owner, id: OTHER_ID };

      await expect(
        inWorkspace(() => service.initiatePayment({ subscriptionId: SUBSCRIPTION_ID }, intruder)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('settlement', () => {
    it('rejects an underpayment and does not activate the subscription', async () => {
      seedPayment();
      gatewayValidates({ amount: '1.00', currency: 'BDT' });

      await expect(
        service.handleSuccessCallback({ tran_id: 'TT_TEST_1', val_id: 'val-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(payments.get('TT_TEST_1')!.status).toBe(PaymentStatusEnum.PENDING);
      expect(subscriptionService.activateSubscriptionFromPayment).not.toHaveBeenCalled();
    });

    it('rejects a validation response without an amount', async () => {
      seedPayment();
      gatewayValidates({ currency: 'BDT' });

      await expect(service.handleIpn({ tran_id: 'TT_TEST_1', val_id: 'val-1', status: 'VALID' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(subscriptionService.activateSubscriptionFromPayment).not.toHaveBeenCalled();
    });

    it('rejects a payment in another currency', async () => {
      seedPayment();
      gatewayValidates({ amount: '499.00', currency: 'BDT', currency_type: 'USD' });

      await expect(
        service.handleSuccessCallback({ tran_id: 'TT_TEST_1', val_id: 'val-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(subscriptionService.activateSubscriptionFromPayment).not.toHaveBeenCalled();
    });

    it('activates the subscription when the validated amount and currency match the server price', async () => {
      seedPayment();
      gatewayValidates({ amount: '499.00', currency: 'BDT', currency_type: 'BDT' });

      const payment = await service.handleSuccessCallback({ tran_id: 'TT_TEST_1', val_id: 'val-1' });

      expect(payment.status).toBe(PaymentStatusEnum.PAID);
      expect(subscriptionService.activateSubscriptionFromPayment).toHaveBeenCalledWith(
        SUBSCRIPTION_ID,
        'TT_TEST_1',
        PRO_PRICE,
        'val-1',
      );
    });
  });

  describe('lookup and verify', () => {
    it('returns the payment to its owner without customer details', async () => {
      seedPayment();

      const view = await service.getByTransactionId('TT_TEST_1', OWNER_ID);

      expect(view).toEqual({
        transactionId: 'TT_TEST_1',
        status: PaymentStatusEnum.PENDING,
        amount: PRO_PRICE,
        currency: 'BDT',
        paymentMethod: null,
        subscriptionId: SUBSCRIPTION_ID,
      });
      expect(view).not.toHaveProperty('customerEmail');
      expect(view).not.toHaveProperty('customerPhone');
    });

    it('refuses a lookup by a different user', async () => {
      seedPayment();

      await expect(service.getByTransactionId('TT_TEST_1', OTHER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses verify by a different user and does not call the gateway', async () => {
      seedPayment();

      await expect(
        service.verifyPayment({ transactionId: 'TT_TEST_1', valId: 'val-1' }, OTHER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(subscriptionService.activateSubscriptionFromPayment).not.toHaveBeenCalled();
    });
  });
});
