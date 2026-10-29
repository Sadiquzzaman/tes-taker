import { randomUUID } from 'crypto';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Entitlements = {
  organization_id: string;
  plan: { slug: string };
  features: Record<string, boolean>;
  limits: Record<string, number>;
  usage: { total_exams_used: number; exams_used_this_month: number };
};
type ErrorBody = { code?: string; message: string };

/**
 * Account subscriptions (P2-02, FND-07/08): a workspace's plan, the platform admin's overrides,
 * the FEATURE_NOT_IN_PLAN / PLAN_LIMIT_REACHED codes and "Request this feature".
 */
describe('entitlements API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  let subjectId: string;
  let proPlanId: string;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  const entitlementsFor = async (token: string) => {
    const response = await t.api.get<Payload<Entitlements>>('/me/entitlements', token);
    expect(response.status).toBe(200);
    return response.body.payload;
  };

  /** The machine-readable code of an error response (design §8.3). */
  const codeOf = (body: unknown) => (body as ErrorBody).code;

  const wizard = (questionType: 'graded' | 'passage') => {
    const correct = randomUUID();
    const options = [
      { id: correct, text: 'Gravity', image: null },
      { id: randomUUID(), text: 'Friction', image: null },
      { id: randomUUID(), text: 'Magnetism', image: null },
    ];
    const question = {
      id: randomUUID(),
      subType: 'multiple-choice',
      text: 'Which force keeps the Moon in orbit?',
      instruction: '',
      image: null,
      answer: { type: 'optionId', value: [correct] },
      options,
      points: 2,
      showValidation: false,
    };
    return {
      formState: { testName: 'Quiz', duration: '30', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false },
      subjects: [
        {
          id: subjectId,
          questions:
            questionType === 'graded'
              ? [{ ...question, type: 'graded' }]
              : [{ id: randomUUID(), type: 'passage-question', passageText: 'A short passage.', childQuestions: [{ ...question, type: 'passage-question' }] }],
        },
      ],
      publishState: {
        publishTiming: 'later',
        scheduleAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        endingAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        testAudience: 'anyone',
        excluded_students: [],
      },
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    subjectId = (await t.dataSource.getRepository(SubjectEntity).save({ name: `Physics ${randomUUID().slice(0, 6)}` })).id;
    proPlanId = (await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'pro' })).id;
  });

  afterAll(async () => {
    await t.close();
  });

  it("gives a solo teacher their own workspace's plan (Free without a subscription)", async () => {
    const teacher = await make.teacher();
    const entitlements = await entitlementsFor(t.tokenFor(teacher));
    const solo = await make.soloOrganization(teacher);
    expect(entitlements).toMatchObject({ organization_id: solo.id, plan: { slug: 'free' } });
  });

  it("uses the school's plan in a school, and counts the school's tests, not the teacher's", async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const teacher = await make.teacher();
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);

    const assigned = await t.api.post('/subscriptions/admin/assign', { organization_id: school.id, plan_id: proPlanId }, t.tokenFor(admin));
    expect(assigned.status).toBe(201);

    // The teacher's own tests do not count in the school.
    await make.openExam(teacher);
    await make.openExam(owner, { organization_id: school.id });

    const inSchool = await entitlementsFor(orgSession(teacher, school, OrganizationMemberRoleEnum.TEACHER));
    expect(inSchool).toMatchObject({ organization_id: school.id, plan: { slug: 'pro' }, usage: { total_exams_used: 1 } });

    const ownWorkspace = await entitlementsFor(t.tokenFor(teacher));
    expect(ownWorkspace).toMatchObject({ plan: { slug: 'free' }, usage: { total_exams_used: 1 } });
  });

  it('refuses a locked feature with FEATURE_NOT_IN_PLAN, until a platform admin switches it on', async () => {
    const teacher = await make.teacher();
    const token = t.tokenFor(teacher);

    const locked = await t.api.post('/exams', wizard('passage'), token);
    expect(locked.status).toBe(403);
    expect(codeOf(locked.body)).toBe('FEATURE_NOT_IN_PLAN');

    const solo = await make.soloOrganization(teacher);
    const override = await t.api.request('PUT', `/subscriptions/admin/organizations/${solo.id}/overrides/allow_passage_questions`, {
      body: { value: true, reason: 'Trial' },
      token: t.tokenFor(admin),
    });
    expect(override.status).toBe(200);
    // The change shows at once (the cached entitlements were dropped).
    expect((await entitlementsFor(token)).features.allow_passage_questions).toBe(true);
    expect((await t.api.post('/exams', wizard('passage'), token)).status).toBe(201);

    await t.api.request('DELETE', `/subscriptions/admin/organizations/${solo.id}/overrides/allow_passage_questions`, { token: t.tokenFor(admin) });
    expect((await entitlementsFor(token)).features.allow_passage_questions).toBeFalsy();
  });

  it('ignores an override once it has expired', async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    await t.api.request('PUT', `/subscriptions/admin/organizations/${solo.id}/overrides/allow_model_tests`, {
      body: { value: true, expires_at: new Date(Date.now() - 60_000).toISOString() },
      token: t.tokenFor(admin),
    });
    expect((await entitlementsFor(t.tokenFor(teacher))).features.allow_model_tests).toBeFalsy();
  });

  it('stops new tests at the plan limit with PLAN_LIMIT_REACHED', async () => {
    const teacher = await make.teacher();
    const token = t.tokenFor(teacher);
    // Free allows 2 tests in total.
    await make.openExam(teacher);
    await make.openExam(teacher);

    const check = await t.api.get<Payload<{ allowed: boolean }>>('/subscriptions/can-create-exam', token);
    expect(check.body.payload.allowed).toBe(false);
    const refused = await t.api.post('/exams', wizard('graded'), token);
    expect(refused.status).toBe(403);
    expect(codeOf(refused.body)).toBe('PLAN_LIMIT_REACHED');
  });

  it("lets only a school's owner or admin change its plan", async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    const teacher = await make.teacher();
    await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    const body = { plan_id: proPlanId, billing_cycle: 'MONTHLY' };

    const byTeacher = await t.api.post('/subscriptions/subscribe', body, orgSession(teacher, school, OrganizationMemberRoleEnum.TEACHER));
    expect(byTeacher.status).toBe(403);

    const byOwner = await t.api.post<Payload<{ organization_id: string; status: string; price_due: string }>>(
      '/subscriptions/subscribe',
      body,
      orgSession(owner, school),
    );
    expect(byOwner.status).toBe(201);
    expect(byOwner.body.payload).toMatchObject({ organization_id: school.id, status: 'PENDING' });
    expect(Number(byOwner.body.payload.price_due)).toBeGreaterThan(0);
  });

  it('records "Request this feature" once per open request and lists it for platform admins', async () => {
    const teacher = await make.teacher();
    const token = t.tokenFor(teacher);
    const first = await t.api.post<Payload<{ id: string }>>('/me/feature-requests', { feature_key: 'allow_model_tests', note: 'For mock exams' }, token);
    const again = await t.api.post<Payload<{ id: string }>>('/me/feature-requests', { feature_key: 'allow_model_tests' }, token);
    expect(first.status).toBe(201);
    expect(again.body.payload.id).toBe(first.body.payload.id);

    const unknown = await t.api.post('/me/feature-requests', { feature_key: 'not_a_feature' }, token);
    expect(unknown.status).toBe(400);

    const list = await t.api.get<Payload<Array<{ id: string; feature_key: string; user: Record<string, unknown> | null }>>>(
      '/subscriptions/admin/feature-requests?status=OPEN',
      t.tokenFor(admin),
    );
    const row = list.body.payload.find((request) => request.id === first.body.payload.id);
    expect(row).toEqual(
      expect.objectContaining({
        feature_key: 'allow_model_tests',
        user: expect.objectContaining({ id: teacher.id }),
        organization: expect.objectContaining({ kind: 'SOLO' }),
      }),
    );
    // Only what the list shows: never the password hash.
    expect(Object.keys(row?.user ?? {}).sort()).toEqual(['email', 'full_name', 'id', 'phone']);
  });

  it('has no entitlements for a student without a workspace', async () => {
    const student = await make.student();
    expect((await t.api.get('/me/entitlements', t.tokenFor(student))).status).toBe(403);
  });
});
