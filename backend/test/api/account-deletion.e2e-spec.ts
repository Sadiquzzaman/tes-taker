import { DeepPartial } from 'typeorm';
import { EnrolmentEntity, EnrolmentStatusEnum } from '../../src/academics/entities/enrolment.entity';
import { ActiveStatusEnum } from '../../src/common/enums/active-status.enum';
import { CryptoUtil } from '../../src/common/utils/crypto.util';
import { ExamSubmissionStatusEnum, StudentExamSubmissionEntity } from '../../src/exams/entities/student-exam-answer.entity';
import { AccountDeletion1756560000000 } from '../../src/migrations/1756560000000-AccountDeletion';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from '../../src/organizations/entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SmsRateLimitService } from '../../src/sms/sms-rate-limit.service';
import { RefreshTokenEntity } from '../../src/user/entities/refresh-token.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; details?: { organizations?: { id: string; name: string }[] } };
type Tokens = { access_token: string; refresh_token: string };

/** Deleting one's own account (mobile-api #358): deactivated and anonymised, the school's history kept. */
describe('account deletion', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let crypto: CryptoUtil;
  const password = 'Delete#Pass123';

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    crypto = t.app.get(CryptoUtil);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  const login = async (user: Pick<UserEntity, 'phone'>) => {
    const response = await t.api.post<Body<Tokens>>('/auth/login', { phone: user.phone, password });
    expect(response.status).toBe(200);
    return response.body.payload;
  };
  const status = (token: string) => t.api.get<Body<{ canDelete: boolean; code?: string; organizations?: { name: string }[] }>>('/me/account-deletion', token);
  const remove = (token: string, body: Record<string, unknown>) => t.api.post<Body<{ deleted: boolean }>>('/me/account-deletion', body, token);
  const userRow = (id: string) => t.dataSource.getRepository(UserEntity).findOneByOrFail({ id });

  it('deletes a student with their password: anonymised, signed out everywhere, out of their classes, history kept', async () => {
    const teacher = await make.teacher();
    const classEntity = await make.classOf(teacher);
    const student = await make.student({ password: await crypto.hashPassword(password) });
    const enrolment = await make.enrol(classEntity, student);
    const exam = await make.openExam(teacher, { class_id: classEntity.id });
    await t.dataSource.getRepository(StudentExamSubmissionEntity).save({
      exam_id: exam.id,
      student_id: student.id,
      status: ExamSubmissionStatusEnum.SUBMITTED,
    } as DeepPartial<StudentExamSubmissionEntity>);
    const { phone, email } = student;
    const phoneSession = await login(student);
    const web = await login(student);

    expect((await status(web.access_token)).body.payload).toEqual({ canDelete: true });

    const wrong = await remove(web.access_token, { password: 'Not#ThePassword1' });
    expect([wrong.status, wrong.body.code]).toEqual([400, 'INVALID_PASSWORD']);
    expect((await userRow(student.id)).full_name).toBe(student.full_name);

    const done = await remove(web.access_token, { password, reason: 'Finished school' });
    expect(done.status).toBe(200);
    expect(done.body.payload).toEqual({ deleted: true });

    const row = await userRow(student.id);
    expect(row).toMatchObject({ full_name: 'Deleted user', email: null, google_id: null, is_active: ActiveStatusEnum.INACTIVE, deletion_reason: 'Finished school', deleted_by: student.id });
    expect(row.deleted_at).toBeInstanceOf(Date);
    expect(row.phone).toMatch(/^del-[0-9a-f]{10}$/);
    // Every device is signed out, and the old phone and email sign in to nothing.
    const tokens = await t.dataSource.getRepository(RefreshTokenEntity).find({ where: { user_id: student.id } });
    expect(tokens.map((r) => r.revoked_reason)).toEqual(['ACCOUNT_DELETED', 'ACCOUNT_DELETED']);
    expect((await t.api.post('/auth/refresh', { refreshToken: phoneSession.refresh_token })).status).toBe(401);
    expect((await t.api.post<Body<unknown>>('/auth/login', { phone, password })).status).toBe(401);
    expect((await t.api.post<Body<unknown>>('/auth/login', { email, password })).status).toBe(401);
    // Out of the class; the hand-in stays with the school.
    expect((await t.dataSource.getRepository(EnrolmentEntity).findOneByOrFail({ id: enrolment.id })).status).toBe(EnrolmentStatusEnum.LEFT);
    expect(await t.dataSource.getRepository(StudentExamSubmissionEntity).countBy({ student_id: student.id })).toBe(1);
    // The phone and email are free for a new account.
    const again = await t.api.post('/auth/register', { full_name: 'Back again', phone, email, password, confirm_password: password });
    expect(again.status).toBeLessThan(300);
  });

  it('confirms with a code sent to the phone instead, and counts wrong codes', async () => {
    const student = await make.student({ password: await crypto.hashPassword(password) });
    const { access_token } = await login(student);
    expect((await remove(access_token, { otp: '123456' })).body.code).toBe('OTP_EXPIRED');

    const sent = await t.api.post<Body<{ maskedPhone: string }>>('/me/account-deletion/otp', {}, access_token);
    expect(sent.status).toBe(200);
    expect(sent.body.payload.maskedPhone).toBe(`${student.phone.slice(0, 3)}****${student.phone.slice(-2)}`);
    const outbox = await t.dataSource.getRepository(NotificationOutboxEntity).findOneByOrFail({ recipient_id: student.id, event_type: 'auth.account_deletion' });
    expect(outbox).toMatchObject({ channel: 'SMS', to_address: student.phone, organization_id: null });

    const otp = (await t.app.get(SmsRateLimitService).getAccountDeletionOtp(student.id))!;
    const wrongOtp = otp === '000000' ? '111111' : '000000';
    expect((await remove(access_token, { otp: wrongOtp })).body.code).toBe('OTP_INVALID');
    expect((await remove(access_token, { otp })).status).toBe(200);
    expect((await userRow(student.id)).full_name).toBe('Deleted user');
  });

  it('locks after five wrong passwords', async () => {
    const student = await make.student({ password: await crypto.hashPassword(password) });
    const { access_token } = await login(student);
    let last = await remove(access_token, { password: 'Wrong#Pass0001' });
    for (let i = 0; i < 5 && last.status !== 429; i += 1) last = await remove(access_token, { password: 'Wrong#Pass0001' });
    expect([last.status, last.body.code]).toEqual([429, 'OTP_LOCKED']);
    // Even the right password waits for the lock to end.
    expect((await remove(access_token, { password })).status).toBe(429);
    expect((await userRow(student.id)).deleted_at).toBeNull();
  });

  it('refuses an organisation owner until the organisation has another owner', async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false, password: await crypto.hashPassword(password) });
    const school = await make.organization(owner, { name: 'Owner School' });
    const { access_token } = await login(owner);

    expect((await status(access_token)).body.payload).toEqual({
      canDelete: false,
      code: 'OWNER_MUST_TRANSFER',
      organizations: [{ id: school.id, name: 'Owner School' }],
    });
    const refused = await remove(access_token, { password });
    expect([refused.status, refused.body.code]).toEqual([409, 'OWNER_MUST_TRANSFER']);
    expect(refused.body.details?.organizations).toEqual([{ id: school.id, name: 'Owner School' }]);
    expect((await t.api.post<Body<unknown>>('/me/account-deletion/otp', {}, access_token)).status).toBe(409);
    expect((await userRow(owner.id)).deleted_at).toBeNull();
  });

  it('closes a solo teacher\'s own workspace and takes a school teacher off the staff', async () => {
    const teacher = await make.teacher({ password: await crypto.hashPassword(password) });
    const solo = await make.soloOrganization(teacher);
    const schoolOwner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(schoolOwner);
    const membership = await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
    const { access_token } = await login(teacher);

    expect((await status(access_token)).body.payload).toEqual({ canDelete: true });
    expect((await remove(access_token, { password })).status).toBe(200);

    expect(await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ id: solo.id })).toMatchObject({ status: 'inactive', name: 'Deleted user' });
    expect(await t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ id: school.id })).toMatchObject({ status: 'approved' });
    const member = await t.dataSource.getRepository(OrganizationMemberEntity).findOneByOrFail({ id: membership.id });
    expect(member).toMatchObject({ is_active: ActiveStatusEnum.INACTIVE, removed_by: teacher.id });
    expect(member.removed_at).toBeInstanceOf(Date);
  });

  it('migration: adds the columns, safely twice, and reverts', async () => {
    const migration = new AccountDeletion1756560000000();
    const runner = t.dataSource.createQueryRunner();
    const columns = async () =>
      (await runner.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('deleted_at', 'deleted_by', 'deletion_reason') ORDER BY 1`)).map(
        (r: { column_name: string }) => r.column_name,
      );
    try {
      await migration.down(runner);
      expect(await columns()).toEqual([]);
      await migration.up(runner);
      await migration.up(runner);
      expect(await columns()).toEqual(['deleted_at', 'deleted_by', 'deletion_reason']);
    } finally {
      await runner.release();
    }
  });
});
