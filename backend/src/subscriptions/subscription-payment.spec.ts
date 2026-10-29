import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatusEnum } from './entities/account-subscription.entity';

/**
 * P0-05, now per organisation (P2-02): checkout only works for the workspace's own PENDING
 * subscription, by someone who may manage its billing, and a subscription is never activated
 * for less than its server-side price.
 */
describe('SubscriptionService payment guards (P0-05, P2-02)', () => {
  const ORG_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_ORG_ID = '22222222-2222-4222-8222-222222222222';
  const SUBSCRIPTION_ID = '33333333-3333-4333-8333-333333333333';
  const OWNER_ID = '44444444-4444-4444-8444-444444444444';
  const TEACHER_ID = '55555555-5555-4555-8555-555555555555';

  let subscriptionRepo: { findOne: jest.Mock; save: jest.Mock };
  let paymentHistoryRepo: { create: jest.Mock; save: jest.Mock };
  let memberRepo: { findOne: jest.Mock };
  let entitlements: { findActiveSubscription: jest.Mock; invalidate: jest.Mock };
  let service: SubscriptionService;
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = {
      id: SUBSCRIPTION_ID,
      organization_id: ORG_ID,
      teacher_id: OWNER_ID,
      plan_id: 'plan-pro',
      price_due: '499.00',
      amount_paid: '0.00',
      status: SubscriptionStatusEnum.PENDING,
    };
    subscriptionRepo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id && where.id !== stored.id) return null;
        if (where.organization_id && where.organization_id !== stored.organization_id) return null;
        if (where.status && where.status !== stored.status) return null;
        return { ...stored };
      }),
      save: jest.fn(async (entity) => entity),
    };
    paymentHistoryRepo = { create: jest.fn((plain) => plain), save: jest.fn(async (entity) => entity) };
    // OWNER_ID owns the school; TEACHER_ID is only a teacher there.
    memberRepo = {
      findOne: jest.fn(async ({ where }: { where: { user_id?: string; role?: string } }) => {
        const role = where.user_id === OWNER_ID ? OrganizationMemberRoleEnum.OWNER : where.user_id === TEACHER_ID ? OrganizationMemberRoleEnum.TEACHER : null;
        if (!role && !where.role) return null;
        return { user_id: where.user_id ?? OWNER_ID, role: role ?? where.role, is_active: 1, organization: { kind: OrganizationKindEnum.SCHOOL } };
      }),
    };
    entitlements = { findActiveSubscription: jest.fn(async () => null), invalidate: jest.fn(async () => undefined) };
    service = new SubscriptionService(
      {} as never, // planRepo
      subscriptionRepo as never,
      paymentHistoryRepo as never,
      {} as never, // userRepo
      {} as never, // overrideRepo
      {} as never, // featureRequestRepo
      {} as never, // organizationRepo
      memberRepo as never,
      entitlements as never,
      {} as never, // soloOrganizations
    );
  });

  it("does not hand out another organisation's subscription for checkout", async () => {
    await expect(service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, OTHER_ORG_ID, OWNER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets only the owner or an admin pay for the workspace', async () => {
    await expect(service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, ORG_ID, TEACHER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses checkout for a subscription that is not PENDING', async () => {
    stored.status = SubscriptionStatusEnum.ACTIVE;

    await expect(service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, ORG_ID, OWNER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns the workspace's PENDING subscription with its server-side price", async () => {
    const subscription = await service.getPendingSubscriptionForPayment(SUBSCRIPTION_ID, ORG_ID, OWNER_ID);

    expect(Number(subscription.price_due)).toBe(499);
  });

  it('refuses to activate when the paid amount is below the price', async () => {
    await expect(
      service.activateSubscriptionFromPayment(SUBSCRIPTION_ID, 'TT_TEST_1', 1, 'val-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(subscriptionRepo.save).not.toHaveBeenCalled();
    expect(paymentHistoryRepo.save).not.toHaveBeenCalled();
  });

  it('activates when the paid amount matches the price, and refreshes entitlements', async () => {
    const activated = await service.activateSubscriptionFromPayment(SUBSCRIPTION_ID, 'TT_TEST_1', 499, 'val-1');

    expect(activated.status).toBe(SubscriptionStatusEnum.ACTIVE);
    expect(Number(activated.amount_paid)).toBe(499);
    expect(paymentHistoryRepo.save).toHaveBeenCalledWith(expect.objectContaining({ organization_id: ORG_ID }));
    expect(entitlements.invalidate).toHaveBeenCalledWith(ORG_ID);
  });
});
