import { OrganizationMemberEntity } from '../../src/organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { FeatureOverrideEntity } from '../../src/subscriptions/entities/feature-override.entity';
import { TestUsersSeedService } from '../../src/user/test-users.seed';
import { UserEntity } from '../../src/user/entities/user.entity';
import { createTestApp, TestApp } from '../support/test-app';

/** The test seed's demo school: one account per role and the features on, added once. */
describe('demo school seed', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    delete process.env.SEED_TEST_USERS;
    await t.close();
  });

  it('adds the demo school with an owner, admin, staff member, two teachers, students and a solo teacher, once', async () => {
    process.env.SEED_TEST_USERS = 'true';
    const seed = t.app.get(TestUsersSeedService);
    await seed.seedIfEnabled();
    await seed.seedIfEnabled();

    const school = await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ name: 'Demo School' });
    const members = await t.dataSource.getRepository(OrganizationMemberEntity).find({ where: { organization_id: school.id }, relations: ['user'] });
    expect(members.map((m) => [m.user.email, m.role]).sort()).toEqual(
      [
        ['demo.admin@yopmail.com', 'ADMIN'],
        ['demo.owner@yopmail.com', 'OWNER'],
        ['demo.staff@yopmail.com', 'ASSISTANT'],
        ['demo.teacher1@yopmail.com', 'TEACHER'],
        ['demo.teacher2@yopmail.com', 'TEACHER'],
      ].sort(),
    );
    const overrides = await t.dataSource.getRepository(FeatureOverrideEntity).find({ where: { organization_id: school.id } });
    expect(overrides.map((o) => [o.key, o.value]).sort()).toEqual([['attendance', true], ['calendar', true], ['homework', true]]);
    const users = t.dataSource.getRepository(UserEntity);
    expect(await users.count({ where: { email: 'demo.student1@yopmail.com' } })).toBe(1);
    expect((await users.findOneByOrFail({ email: 'demo.solo@yopmail.com' })).personal_teacher_enabled).toBe(true);
    expect(await t.dataSource.getRepository(OrganizationEntity).countBy({ name: 'Demo School' })).toBe(1);

    // The large Sunrise School and a platform admin, for testing on beta with a lot of data.
    const sunrise = await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ name: 'Sunrise School' });
    const sunriseMembers = await t.dataSource.getRepository(OrganizationMemberEntity).find({ where: { organization_id: sunrise.id } });
    expect(sunriseMembers.map((m) => m.role).sort()).toEqual(['ADMIN', 'ASSISTANT', 'ASSISTANT', 'OWNER', ...Array(8).fill('TEACHER')].sort());
    expect(await users.count({ where: { email: 'sun.student60@yopmail.com', role: 'STUDENT' as UserEntity['role'] } })).toBe(1);
    expect((await users.findOneByOrFail({ email: 'sun.solo@yopmail.com' })).personal_teacher_enabled).toBe(true);
    expect((await users.findOneByOrFail({ email: 'test.platform@yopmail.com' })).role).toBe('ADMIN');
    const sunriseOverrides = await t.dataSource.getRepository(FeatureOverrideEntity).find({ where: { organization_id: sunrise.id } });
    expect(sunriseOverrides.map((o) => o.key).sort()).toEqual(['attendance', 'calendar', 'homework']);
    expect(await t.dataSource.getRepository(OrganizationEntity).countBy({ name: 'Sunrise School' })).toBe(1);
    // Both seeded schools are on Pro, once, like every school.
    const plans = await t.dataSource.query(
      `SELECT o.name, p.slug, count(*)::int AS n FROM account_subscriptions s JOIN organizations o ON o.id = s.organization_id JOIN subscription_plans p ON p.id = s.plan_id
       WHERE o.name IN ('Demo School', 'Sunrise School') AND s.status = 'ACTIVE' GROUP BY 1, 2 ORDER BY 1`,
    );
    expect(plans).toEqual([
      { name: 'Demo School', slug: 'pro', n: 1 },
      { name: 'Sunrise School', slug: 'pro', n: 1 },
    ]);
  });
});
