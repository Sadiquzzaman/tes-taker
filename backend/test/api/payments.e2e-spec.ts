import { PaymentEntity } from '../../src/modules/payment/entities/payment.entity';
import { PaymentStatusEnum } from '../../src/modules/payment/enums/payment-status.enum';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import {
  SubscriptionStatusEnum,
  TeacherSubscriptionEntity,
} from '../../src/subscriptions/entities/teacher-subscription.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * P0-05 against the real app and database: the price comes from the server, only the owner
 * can pay for or read a subscription's payment, and an underpayment never activates a plan.
 * SSLCommerz is faked (outbound HTTP is blocked in tests).
 */
describe('payments API', () => {
  let t: TestApp;
  let owner: UserEntity;
  let otherTeacher: UserEntity;
  let basicPlan: SubscriptionPlanEntity;

  const sessionApi = 'sslcommerz.test/gwprocess';
  const validationApi = 'sslcommerz.test/validator';

  beforeAll(async () => {
    t = await createTestApp();
    const make = factories(t.dataSource);
    owner = await make.teacher();
    otherTeacher = await make.teacher();
    basicPlan = await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'basic' });
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(() => {
    t.outbound.reset();
    t.outbound.respond(sessionApi, () => ({ status: 'SUCCESS', GatewayPageURL: 'https://sslcommerz.test/pay' }));
  });

  /** The owner picks the Basic monthly plan, which creates a PENDING subscription priced by the server. */
  const pendingSubscription = async () => {
    const response = await t.api.post<{ payload: { id: string } }>(
      '/subscriptions/subscribe',
      { plan_id: basicPlan.id, billing_cycle: 'MONTHLY' },
      t.tokenFor(owner),
    );
    expect(response.status).toBe(201);
    return response.body.payload.id;
  };

  const initiate = (subscriptionId: string, token: string | undefined, extra: Record<string, unknown> = {}) =>
    t.api.post<{ payload: { transactionId: string; amount: number } }>(
      '/payments/initiate',
      { subscriptionId, ...extra },
      token,
    );

  /** Simulates SSLCommerz's IPN for a payment, validated at `amount` BDT. */
  const settleWith = async (transactionId: string, amount: string, currency = 'BDT') => {
    t.outbound.respond(validationApi, () => ({ status: 'VALID', tran_id: transactionId, amount, currency_type: currency }));
    return t.api.request('POST', '/payments/ipn', {
      form: { tran_id: transactionId, val_id: `val-${transactionId}`, status: 'VALID' },
    });
  };

  const subscriptionStatus = async (id: string) =>
    (await t.dataSource.getRepository(TeacherSubscriptionEntity).findOneByOrFail({ id })).status;

  const paymentStatus = async (transactionId: string) =>
    (await t.dataSource.getRepository(PaymentEntity).findOneByOrFail({ transactionId })).status;

  it('charges the server price and ignores an amount sent by the browser', async () => {
    const subscriptionId = await pendingSubscription();

    const response = await initiate(subscriptionId, t.tokenFor(owner), { amount: 1 });

    expect(response.status).toBe(201);
    expect(response.body.payload.amount).toBe(100);
    const sessionCall = t.outbound.calls.find((call) => call.url.includes(sessionApi));
    expect(new URLSearchParams(String(sessionCall?.data)).get('total_amount')).toBe('100.00');
  });

  it('requires a login to start a payment', async () => {
    const subscriptionId = await pendingSubscription();

    await expect(initiate(subscriptionId, undefined)).resolves.toMatchObject({ status: 401 });
  });

  it("refuses to start a payment for another teacher's subscription", async () => {
    const subscriptionId = await pendingSubscription();

    const response = await initiate(subscriptionId, t.tokenFor(otherTeacher));

    expect([403, 404]).toContain(response.status);
    expect(t.outbound.calls.some((call) => call.url.includes(sessionApi))).toBe(false);
  });

  it('does not activate the plan when the gateway reports an underpayment', async () => {
    const subscriptionId = await pendingSubscription();
    const { transactionId } = (await initiate(subscriptionId, t.tokenFor(owner))).body.payload;

    await settleWith(transactionId, '1.00');

    expect(await subscriptionStatus(subscriptionId)).toBe(SubscriptionStatusEnum.PENDING);
    expect(await paymentStatus(transactionId)).not.toBe(PaymentStatusEnum.PAID);
  });

  it('does not activate the plan when the currency is wrong', async () => {
    const subscriptionId = await pendingSubscription();
    const { transactionId } = (await initiate(subscriptionId, t.tokenFor(owner))).body.payload;

    await settleWith(transactionId, '100.00', 'USD');

    expect(await subscriptionStatus(subscriptionId)).toBe(SubscriptionStatusEnum.PENDING);
  });

  it('activates the plan when the full price is paid', async () => {
    const subscriptionId = await pendingSubscription();
    const { transactionId } = (await initiate(subscriptionId, t.tokenFor(owner))).body.payload;

    const response = await settleWith(transactionId, '100.00');

    expect(response.status).toBe(201);
    expect(await paymentStatus(transactionId)).toBe(PaymentStatusEnum.PAID);
    expect(await subscriptionStatus(subscriptionId)).toBe(SubscriptionStatusEnum.ACTIVE);
  });

  it('shows a payment only to the teacher who made it', async () => {
    const subscriptionId = await pendingSubscription();
    const { transactionId } = (await initiate(subscriptionId, t.tokenFor(owner))).body.payload;

    await expect(t.api.get(`/payments/${transactionId}`, t.tokenFor(owner))).resolves.toMatchObject({ status: 200 });
    await expect(t.api.get(`/payments/${transactionId}`, t.tokenFor(otherTeacher))).resolves.toMatchObject({
      status: 404,
    });
    await expect(t.api.get(`/payments/${transactionId}`)).resolves.toMatchObject({ status: 401 });
  });
});
