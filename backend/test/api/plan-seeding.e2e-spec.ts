import { RolesEnum } from '../../src/common/enums/roles.enum';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { SubscriptionService } from '../../src/subscriptions/subscription.service';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/** Preset plans fill in what is missing; Admin → Plans owns the values after that. */
describe('plan seeding', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;

  const plans = () => t.dataSource.getRepository(SubscriptionPlanEntity);
  /** What the API does on every start. */
  const restart = () => t.app.get(SubscriptionService).onModuleInit();

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
  });

  afterAll(async () => {
    await t.close();
  });

  it("keeps an admin's changes to a preset plan across a restart", async () => {
    const premium = await plans().findOneByOrFail({ slug: 'premium' });
    await plans().save({
      ...premium,
      price_monthly: 350,
      limits: { ...premium.limits, max_exams_per_month: 20 },
      is_plan_active: false,
    });

    await restart();

    const after = await plans().findOneByOrFail({ slug: 'premium' });
    expect(Number(after.price_monthly)).toBe(350);
    expect(after.limits.max_exams_per_month).toBe(20);
    expect(after.is_plan_active).toBe(false);
  });

  it('creates a missing preset plan again and leaves custom plans alone', async () => {
    await plans().delete({ slug: 'basic' });
    const custom = await plans().save(plans().create({ name: 'Coaching 50', slug: 'coaching-50', price_monthly: 700, is_custom: true }));

    await restart();

    expect(await plans().findOneBy({ slug: 'basic' })).toEqual(expect.objectContaining({ name: 'Basic', is_plan_active: true }));
    expect(await plans().findOneByOrFail({ id: custom.id })).toEqual(expect.objectContaining({ name: 'Coaching 50', is_custom: true }));
    expect(await plans().countBy({ slug: 'basic' })).toBe(1);
  });

  it('adds the storage quota (FND-16) only to preset plans that have none, keeping an admin value', async () => {
    const free = await plans().findOneByOrFail({ slug: 'free' });
    const pro = await plans().findOneByOrFail({ slug: 'pro' });
    const { max_storage_mb: _free, ...freeLimits } = free.limits as Record<string, number>;
    await plans().save({ ...free, limits: freeLimits });
    await plans().save({ ...pro, limits: { ...pro.limits, max_storage_mb: 0 } });

    await restart();

    expect((await plans().findOneByOrFail({ slug: 'free' })).limits.max_storage_mb).toBe(500);
    expect((await plans().findOneByOrFail({ slug: 'pro' })).limits.max_storage_mb).toBe(0);

    // Back to the preset for the other test files sharing these plans.
    const { max_storage_mb: _pro, ...proLimits } = pro.limits as Record<string, number>;
    await plans().save({ ...pro, limits: proLimits });
    await restart();
    expect((await plans().findOneByOrFail({ slug: 'pro' })).limits.max_storage_mb).toBe(51_200);
  });

  it('refuses to delete the Free plan, which organisations without a subscription use', async () => {
    const admin = await make.user(RolesEnum.SUPER_ADMIN);
    const free = await plans().findOneByOrFail({ slug: 'free' });

    const response = await t.api.request<{ message: string }>('DELETE', `/subscriptions/admin/plans/${free.id}`, { token: t.tokenFor(admin) });

    expect(response.status).toBe(400);
    expect(await plans().findOneBy({ id: free.id })).not.toBeNull();
  });
});
