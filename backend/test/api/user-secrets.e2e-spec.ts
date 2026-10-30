import { randomUUID } from 'crypto';
import { ClassSubjectEntity } from '../../src/classes/entities/class-subject.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { RedisService } from '../../src/config/redis.service';
import { ExamPaperCacheService } from '../../src/exams/exam-paper-cache.service';
import { examPaperCacheKey } from '../../src/exams/exam-paper-cache.constants';
import { ExamEntity } from '../../src/exams/entities/exam.entity';
import { TestAudienceEnum } from '../../src/exams/enums/exam-wizard.enums';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import {
  AccountSubscriptionEntity,
  SubscriptionStatusEnum,
} from '../../src/subscriptions/entities/account-subscription.entity';
import { PaymentHistoryEntity, PaymentStatusEnum } from '../../src/subscriptions/entities/payment-history.entity';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type Tokens = { access_token: string; refresh_token: string };

const SECRET_KEYS = ['password', 'refresh_token'];

/**
 * Every path in `value` whose key is a stored secret column with a value, e.g. `payload[0].teacher.password`.
 * A `null` is not a leak: an entity returned by `save()` carries unloaded nullable columns as null.
 */
const secretKeyPaths = (value: unknown, path = ''): string[] => {
  if (Array.isArray(value)) return value.flatMap((item, i) => secretKeyPaths(item, `${path}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(SECRET_KEYS.includes(key) && child !== null ? [`${path}.${key}`] : []),
    ...secretKeyPaths(child, `${path}.${key}`),
  ]);
};

/**
 * The password hash and the refresh-token hash are never loaded with a user row (`select: false`),
 * so no response that nests users (class rosters, admin lists, ...) can include them.
 */
describe('user secrets in API responses', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let crypto: CryptoUtil;

  let admin: UserEntity;
  let teacher: UserEntity;
  let subjectTeacher: UserEntity;
  let student: UserEntity;
  let classId: string;
  let sectionId: string;
  let storedSecrets: string[];

  /** Each user gets a unique stored password and refresh-token value so a leak is easy to spot. */
  const userWithSecrets = async (role: RolesEnum, overrides: Partial<UserEntity> = {}) => {
    const password = `stored-password-${randomUUID()}`;
    const refresh_token = `stored-refresh-${randomUUID()}`;
    storedSecrets.push(password, refresh_token);
    return make.user(role, { password, refresh_token, ...overrides });
  };

  const expectNoSecrets = (response: { status: number; body: unknown }) => {
    expect(response.status).toBeLessThan(300);
    expect(secretKeyPaths(response.body)).toEqual([]);
    const text = JSON.stringify(response.body);
    for (const secret of storedSecrets) expect(text).not.toContain(secret);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    crypto = t.app.get(CryptoUtil);
    storedSecrets = [];

    admin = await userWithSecrets(RolesEnum.ADMIN);
    teacher = await userWithSecrets(RolesEnum.TEACHER, { personal_teacher_enabled: true });
    subjectTeacher = await userWithSecrets(RolesEnum.TEACHER);
    student = await userWithSecrets(RolesEnum.STUDENT);

    const classRow = await make.classOf(teacher);
    classId = classRow.id;
    await make.enrol(classRow, student);
    const subject = await t.dataSource.getRepository(SubjectEntity).save({ name: `Physics ${randomUUID().slice(0, 8)}` });
    await t.dataSource.getRepository(ClassSubjectEntity).save({ class_id: classId, subject_id: subject.id });
    // The class subject's subject class in section A, taught by the subject teacher.
    const [offering] = await t.dataSource.query(
      `SELECT o.id, o.section_id, o.organization_id FROM course_offerings o JOIN sections s ON s.id = o.section_id WHERE s.class_id = $1`,
      [classId],
    );
    sectionId = offering.section_id;
    await t.dataSource.query(`INSERT INTO offering_teachers (organization_id, offering_id, teacher_id) VALUES ($1, $2, $3)`, [
      offering.organization_id,
      offering.id,
      subjectTeacher.id,
    ]);

    const solo = await make.soloOrganization(teacher);
    const plan = await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'basic' });
    const subscription = await t.dataSource.getRepository(AccountSubscriptionEntity).save({
      organization_id: solo.id,
      plan_id: plan.id,
      teacher_id: teacher.id,
      price_due: 0,
      amount_paid: 0,
      status: SubscriptionStatusEnum.ACTIVE,
      start_date: new Date(),
    });
    await t.dataSource.getRepository(PaymentHistoryEntity).save({
      teacher_id: teacher.id,
      organization_id: solo.id,
      subscription_id: subscription.id,
      plan_id: plan.id,
      amount: 100,
      status: PaymentStatusEnum.COMPLETED,
    });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('class endpoints with nested teachers and students', () => {
    it.each([
      ['GET /classes', () => t.api.get('/classes', t.tokenFor(teacher))],
      ['GET /classes/:id', () => t.api.get(`/classes/${classId}`, t.tokenFor(teacher))],
      ['GET /classes/:id (admin)', () => t.api.get(`/classes/${classId}`, t.tokenFor(admin))],
      ['GET /classes/:id/students', () => t.api.get(`/classes/${classId}/students`, t.tokenFor(teacher))],
      ['GET /sections/:id/offerings', () => t.api.get(`/sections/${sectionId}/offerings`, t.tokenFor(teacher))],
      ['GET /sections/:id/enrolments', () => t.api.get(`/sections/${sectionId}/enrolments`, t.tokenFor(teacher))],
      ['GET /classes/:id/discussion-subjects', () => t.api.get(`/classes/${classId}/discussion-subjects`, t.tokenFor(teacher))],
      ['GET /classes/:id/subjects', () => t.api.get(`/classes/${classId}/subjects`, t.tokenFor(teacher))],
      [
        'PATCH /classes/:id',
        () => t.api.request('PATCH', `/classes/${classId}`, { body: { description: 'Updated' }, token: t.tokenFor(teacher) }),
      ],
    ])('%s returns the users without their secrets', async (_name, call) => {
      const response = await call();
      expectNoSecrets(response);
    });

    it('still returns the nested users themselves', async () => {
      const response = await t.api.get<Payload<{ classStudents: Array<{ student: { id: string; full_name: string } }> }>>(
        `/classes/${classId}`,
        t.tokenFor(teacher),
      );
      expect(response.body.payload.classStudents[0].student).toMatchObject({ id: student.id, full_name: student.full_name });
    });
  });

  describe('admin subscription endpoints', () => {
    it.each([
      ['GET /subscriptions/admin/all-subscriptions', () => t.api.get('/subscriptions/admin/all-subscriptions', t.tokenFor(admin))],
      ['GET /subscriptions/admin/payments', () => t.api.get('/subscriptions/admin/payments', t.tokenFor(admin))],
      [
        'PATCH /subscriptions/admin/teacher/:id/status',
        () =>
          t.api.request('PATCH', `/subscriptions/admin/teacher/${teacher.id}/status`, {
            body: { active: true },
            token: t.tokenFor(admin),
          }),
      ],
    ])('%s returns the teacher without their secrets', async (_name, call) => {
      const response = await call();
      expectNoSecrets(response);
      expect(JSON.stringify(response.body)).toContain(teacher.id);
    });

    it('saving a user loaded without its secrets keeps the stored values', async () => {
      await t.api.request('PATCH', `/subscriptions/admin/teacher/${teacher.id}/status`, {
        body: { active: false },
        token: t.tokenFor(admin),
      });
      const stored = await t.dataSource
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .addSelect(['user.password', 'user.refresh_token'])
        .where({ id: teacher.id })
        .getOneOrFail();
      expect(stored).toMatchObject({ password: teacher.password, refresh_token: teacher.refresh_token });
    });
  });

  it('the cached exam paper does not hold the target students\' secrets', async () => {
    const exam = await make.openExam(teacher, { test_audience: TestAudienceEnum.SPECIFIC_STUDENTS });
    await t.dataSource.getRepository(ExamEntity).save({ id: exam.id, target_students: [student] });

    await t.app.get(ExamPaperCacheService).refreshExamGraph(exam.id);
    const cached = await t.app.get(RedisService).get(examPaperCacheKey(exam.id));

    expect(cached).toContain(student.id);
    expect(secretKeyPaths(JSON.parse(cached!))).toEqual([]);
  });

  describe('login and password flows still read the password', () => {
    const password = 'Start#Pass123';
    let user: UserEntity;
    let organization: OrganizationEntity;

    beforeAll(async () => {
      user = await make.teacher({ password: await crypto.hashPassword(password) });
      organization = await make.organization(user, { organization_number: '900001' });
    });

    it('logs in with the right password and refuses a wrong one', async () => {
      const ok = await t.api.post<Payload<Tokens>>('/auth/login', { phone: user.phone, password });
      expect(ok.status).toBe(200);
      expect(ok.body.payload.access_token).toEqual(expect.any(String));
      expect(secretKeyPaths(ok.body).filter((key) => key.endsWith('.password'))).toEqual([]);

      const wrong = await t.api.post('/auth/login', { phone: user.phone, password: 'Wrong#Pass123' });
      expect(wrong.status).toBe(401);
    });

    it('logs in to an organisation with the right password', async () => {
      const response = await t.api.post<Payload<Tokens>>('/auth/login/organization', {
        organization_number: String(organization.organization_number),
        phone: user.phone,
        password,
      });
      expect(response.status).toBe(200);
      expect(response.body.payload.access_token).toEqual(expect.any(String));
    });

    it('refreshes the token by its stored hash', async () => {
      const login = await t.api.post<Payload<Tokens>>('/auth/login', { phone: user.phone, password });
      const refreshed = await t.api.post<Payload<Tokens>>('/auth/refresh', { refreshToken: login.body.payload.refresh_token });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.payload.access_token).toEqual(expect.any(String));
    });

    it('changes the password after checking the current one', async () => {
      const token = t.tokenFor(user);
      const wrong = await t.api.post(
        '/auth/change-password',
        { current_password: 'Wrong#Pass123', new_password: 'Next#Pass1234', confirm_password: 'Next#Pass1234' },
        token,
      );
      expect(wrong.status).toBe(400);

      const changed = await t.api.post(
        '/auth/change-password',
        { current_password: password, new_password: 'Next#Pass1234', confirm_password: 'Next#Pass1234' },
        token,
      );
      expect(changed.status).toBeLessThan(300);

      const login = await t.api.post('/auth/login', { phone: user.phone, password: 'Next#Pass1234' });
      expect(login.status).toBe(200);
    });
  });
});
