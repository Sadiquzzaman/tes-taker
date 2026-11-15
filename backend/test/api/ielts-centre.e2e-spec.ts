import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { WorkspaceTypeEnum } from '../../src/organizations/enums/workspace-type.enum';
import { SmsService } from '../../src/sms/sms.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; data?: Record<string, unknown> };
type Profile = { student: { id: string; full_name: string; batch: string | null }; test_type: string | null; target_overall: number | null; target_bands: Record<string, number>; test_date: string | null; days_to_test: number | null };

/**
 * The IELTS centre (P10-01, IEL-01, IEL-02): choosing "IELTS centre" at sign-up gives the IELTS
 * workspace with Course / Batch labels; staff keep each student's test type, target bands and
 * test date; IELTS pages answer only in IELTS centres.
 */
describe('IELTS centre and profiles', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string | undefined, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  /** A centre (IELTS or school) with one batch: owner, a teacher, two students. */
  const centre = async ({ ielts = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (ielts) {
      await t.dataSource.getRepository(OrganizationEntity).update({ id: organization.id }, { kind: OrganizationKindEnum.IELTS_CENTRE, workspace_type: WorkspaceTypeEnum.IELTS } as DeepPartial<OrganizationEntity>);
    }
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/ielts`, { body: { value: true, reason: 'P10-01 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Band 7 Course' })).body.payload.id;
    const [mitu, rafi] = [await make.student({ full_name: 'Mitu' }), await make.student({ full_name: 'Rafi' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    const teacher = await make.teacher({ full_name: 'Tania' });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const [section] = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    return {
      organization,
      ownerToken,
      teacherToken: token(teacher, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      rafi,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      rafiToken: token(rafi, OrganizationMemberRoleEnum.STUDENT),
      sectionId: section.id,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('signs up an IELTS centre with the IELTS workspace and Course / Batch labels; a school stays a school', async () => {
    const sms = t.app.get(SmsService);
    jest.spyOn(sms, 'sendOtp').mockResolvedValue({ success: true, message: 'sent' });
    jest.spyOn(sms, 'verifyOtp').mockResolvedValue({ success: true, message: 'ok' });
    const signUp = async (kind: string | undefined, suffix: string) => {
      const phone = `017${suffix}${String(Date.now()).slice(-6)}`.slice(0, 11);
      const body = { organization_name: `Centre ${suffix}`, full_name: 'Owner', phone, email: `owner.${suffix}.${Date.now()}@example.com`, password: 'StrongPass123!', confirm_password: 'StrongPass123!', ...(kind ? { kind } : {}) };
      expect((await call('POST', '/auth/register/organization', undefined, body)).status).toBe(201);
      expect((await call('POST', '/auth/register/verify-otp', undefined, { phone, otp: '123456' })).status).toBe(200);
      return t.dataSource.getRepository(OrganizationEntity).findOneByOrFail({ name: `Centre ${suffix}` });
    };
    const ielts = await signUp('IELTS_CENTRE', '11');
    expect(ielts).toMatchObject({ kind: 'IELTS_CENTRE', workspace_type: 'IELTS', status: 'pending' });
    expect(ielts.level_labels).toMatchObject({ preset: 'COURSE_BATCH', class: { en: { one: 'Course' } }, section: { en: { one: 'Batch' } } });
    const school = await signUp(undefined, '22');
    expect(school).toMatchObject({ kind: 'SCHOOL', workspace_type: 'ACADEMIC' });
    expect((await call('POST', '/auth/register/organization', undefined, { organization_name: 'X', full_name: 'X', phone: '01700000099', email: 'x@example.com', password: 'StrongPass123!', confirm_password: 'StrongPass123!', kind: 'SOLO' })).status).toBe(400);
  });

  it('tells the web it is an IELTS workspace', async () => {
    const s = await centre();
    expect((await call<{ kind: string; workspace_type: string }>('GET', '/workspace/type', s.ownerToken)).body.payload).toEqual({ kind: 'IELTS_CENTRE', workspace_type: 'IELTS' });
    const school = await centre({ ielts: false });
    expect((await call<{ workspace_type: string }>('GET', '/workspace/type', school.ownerToken)).body.payload.workspace_type).toBe('ACADEMIC');
  });

  it('keeps each student’s test type, target bands and test date; students see only their own', async () => {
    const s = await centre();
    const list = (await call<Profile[]>('GET', `/ielts/profiles?section_id=${s.sectionId}`, s.teacherToken)).body.payload;
    expect(list.map((p) => [p.student.full_name, p.test_type])).toEqual([['Mitu', null], ['Rafi', null]]);

    const testDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const saved = await call<Profile>('PUT', `/ielts/profiles/${s.mitu.id}`, s.teacherToken, { test_type: 'ACADEMIC', target_overall: 7, target_bands: { LISTENING: 7.5, WRITING: 6.5 }, test_date: testDate });
    expect(saved.status).toBe(200);
    expect(saved.body.payload).toMatchObject({ test_type: 'ACADEMIC', target_overall: 7, target_bands: { LISTENING: 7.5, WRITING: 6.5 }, test_date: testDate, days_to_test: 30 });
    expect((await call<Profile>('GET', '/ielts/profiles/me', s.mituToken)).body.payload).toMatchObject({ target_overall: 7, days_to_test: 30 });

    // Bands are 0–9 in half bands; students don't change profiles or read others'.
    for (const bad of [{ target_overall: 7.3 }, { target_overall: 10 }, { target_bands: { READING: 6.25 } }, { target_bands: { MATHS: 6 } }]) {
      expect((await call('PUT', `/ielts/profiles/${s.mitu.id}`, s.teacherToken, bad)).body.code).toBe('IELTS_BAND_INVALID');
    }
    expect((await call('PUT', `/ielts/profiles/${s.mitu.id}`, s.mituToken, { target_overall: 9 })).body.code).toBe('IELTS_STAFF_ONLY');
    expect((await call('GET', `/ielts/profiles/${s.mitu.id}`, s.rafiToken)).status).toBe(404);
    // Someone not in the centre is not found.
    expect((await call('PUT', `/ielts/profiles/${(await make.student()).id}`, s.teacherToken, { target_overall: 6 })).status).toBe(404);

    await t.app.get(AuditService).flush();
    expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'ielts.profile_update' } })).toBe(1);
  });

  it('answers only in IELTS centres', async () => {
    const school = await centre({ ielts: false });
    const res = await call('GET', '/ielts/profiles', school.ownerToken);
    expect([res.status, res.body.code]).toEqual([403, 'IELTS_ONLY_CENTRES']);
  });
});
