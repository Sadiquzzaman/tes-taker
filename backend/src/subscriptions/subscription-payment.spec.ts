import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatusEnum } from './entities/teacher-subscription.entity';

/**
 * P0-05: checkout only works for the caller's own PENDING subscription, and a
 * subscription is never activated for less than its server-side price.
 */
describe('SubscriptionService payment guards (P0-05)', () => {
  const OWNER_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_ID = '22222222-2222-4222-8222-222222222222';
  const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';

  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let paymentHistoryRepo: { create: jest.Mock; save: jest.Mock };
  let service: SubscriptionService;
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = {
      id: SUBSCRIPTION_ID,
      teacher_id: OWNER_ID,
      plan_id: 'plan-pro',
      amount_paid: '499.00',
      status: SubscriptionStatusEnum.PENDING,
    };
    subscriptionRepo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id && where.id !== stored.id) return null;
        if (where.teacher_id && where.teacher_id !== stored.teacher_id) return null;
        if (where.status && where.status !== stored.status) return null;
        return { ...stored };
      }),
      save: jest.fn(async (entity) => entity),
    };
    paymentHistoryRepo = { create: jest.fn((plain) => plain), save: jest.fn(async (entity) => entity) };
    service = new SubscriptionService(
      {} as never,
      subscriptionRepo as never,
      paymentHistoryRepo as never,
      {} as never,
    );
  });

  it("does not hand out another teacher's subscription for checkout", async () => {
    await expect(service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, OTHER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses checkout for a subscription that is not PENDING', async () => {
    stored.status = SubscriptionStatusEnum.ACTIVE;

    await expect(service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, OWNER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns the owner's PENDING subscription with its server-side price", async () => {
    const subscription = await service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, OWNER_ID);

    expect(Number(subscription.amount_paid)).toBe(499);
  });

  it('refuses to activate when the paid amount is below the price', async () => {
    await expect(
      service.activateSubscriptionFromPayment(SUBSCRIPTION_ID, 'TT_TEST_1', 1, 'val-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
    expect(paymentHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('activates when the paid amount matches the price', async () => {
    const activated = await service.activateSubscriptionFromPayment(SUBSCRIPTION_ID, 'TT_TEST_1', 499, 'val-1');

    expect(activated.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(paymentHistoryRepo.save).toHaveBeenCalledTimes(1);
  });
});
