import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { AcademicSessionEntity } from '../../src/academics/entities/academic-session.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrgSettingsEntity } from '../../src/organizations/entities/org-settings.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Settings = {
  attendance_method: string;
  selfie_required: boolean;
  class_attendance_mode: string;
  weekly_off_days: number[];
  student_entry_time: string;
  teacher_entry_time: string;
  guardian_sms: { late: boolean; absent: boolean; leave: boolean };
  repeat_absence_days: number;
};
type Body<T> = { payload: T; code?: string; feature?: string; message?: string };

const DEFAULTS: Settings = {
  attendance_method: 'OFF',
  selfie_required: false,
  class_attendance_mode: 'PER_SESSION',
  weekly_off_days: [5],
  student_entry_time: '09:00',
  teacher_entry_time: '08:45',
  guardian_sms: { late: true, absent: true, leave: true },
  repeat_absence_days: 3,
};

/** Attendance settings (P3-01, ATT-01): defaults, who reads and changes them, the rules, the plan gate, tenancy and audit. */
describe('attendance settings API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  const getSettings = (token: string) => t.api.get<Body<Settings>>('/attendance/settings', token);
  const patchSettings = (token: string, body: unknown) => t.api.request<Body<Settings>>('PATCH', '/attendance/settings', { body, token });

  const enableAttendance = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-01 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) await enableAttendance(organization);
    return { owner, organization, token: orgSession(owner, organization) };
  };

  const memberOf = async (organization: OrganizationEntity, role: OrganizationMemberRoleEnum) => {
    const user = role === OrganizationMemberRoleEnum.STUDENT ? await make.student() : await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, user, role);
    return orgSession(user, organization, role);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    audit = t.app.get(AuditService);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it("gives an organisation without settings the spec's defaults", async () => {
    const { token } = await school();
    const response = await getSettings(token);
    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual(DEFAULTS);
  });

  it('refuses the settings with FEATURE_NOT_IN_PLAN while the plan has no attendance', async () => {
    const { token } = await school({ enabled: false });
    for (const response of [await getSettings(token), await patchSettings(token, { class_attendance_mode: 'DAILY' })]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN', feature: 'attendance' });
    }
  });

  it('lets the owner and admins change the settings; teachers and assistants read them; students neither', async () => {
    const { organization, token } = await school();
    const adminToken = await memberOf(organization, OrganizationMemberRoleEnum.ADMIN);
    const teacherToken = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const assistantToken = await memberOf(organization, OrganizationMemberRoleEnum.ASSISTANT);
    const studentToken = await memberOf(organization, OrganizationMemberRoleEnum.STUDENT);

    const saved = await patchSettings(token, {
      attendance_method: 'WEB',
      class_attendance_mode: 'DAILY',
      weekly_off_days: [6, 5],
      student_entry_time: '08:30',
      teacher_entry_time: '08:15',
      guardian_sms: { late: false },
      repeat_absence_days: 5,
    });
    expect(saved.status).toBe(200);
    const expected = {
      ...DEFAULTS,
      attendance_method: 'WEB',
      class_attendance_mode: 'DAILY',
      weekly_off_days: [5, 6],
      student_entry_time: '08:30',
      teacher_entry_time: '08:15',
      guardian_sms: { late: false, absent: true, leave: true },
      repeat_absence_days: 5,
    };
    expect(saved.body.payload).toEqual(expected);

    expect((await patchSettings(adminToken, { repeat_absence_days: 4 })).status).toBe(200);
    expect((await getSettings(teacherToken)).body.payload).toEqual({ ...expected, repeat_absence_days: 4 });
    expect((await getSettings(assistantToken)).status).toBe(200);
    expect((await patchSettings(teacherToken, { repeat_absence_days: 6 })).status).toBe(403);
    expect((await patchSettings(assistantToken, { repeat_absence_days: 6 })).status).toBe(403);
    expect((await getSettings(studentToken)).status).toBe(403);
  });

  it('keeps one daily presence method, and offers only Off and Web for now', async () => {
    const { token } = await school();
    for (const method of ['ZKTECO', 'APP']) {
      const response = await patchSettings(token, { attendance_method: method });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ATTENDANCE_METHOD_NOT_AVAILABLE');
    }
    expect((await patchSettings(token, { attendance_method: 'BOTH' })).status).toBe(400);
    expect((await patchSettings(token, { attendance_method: 'WEB' })).body.payload.attendance_method).toBe('WEB');
  });

  it('asks for confirmation to switch the method while a session is running, and keeps saved records', async () => {
    const { organization, token } = await school();
    // From Off (first setup) there is nothing to confirm.
    expect((await patchSettings(token, { attendance_method: 'WEB' })).status).toBe(200);
    const settingsId = (await t.dataSource.getRepository(OrgSettingsEntity).findOneByOrFail({ organization_id: organization.id })).id;

    // The default session (this calendar year) is running.
    const unconfirmed = await patchSettings(token, { attendance_method: 'OFF' });
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.body.code).toBe('ATTENDANCE_METHOD_CHANGE_CONFIRM');
    expect((await getSettings(token)).body.payload.attendance_method).toBe('WEB');

    const confirmed = await patchSettings(token, { attendance_method: 'OFF', confirm_method_change: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.payload.attendance_method).toBe('OFF');
    // The same settings row is updated, never replaced.
    expect((await t.dataSource.getRepository(OrgSettingsEntity).findOneByOrFail({ organization_id: organization.id })).id).toBe(settingsId);

    // Outside any session no confirmation is needed.
    expect((await patchSettings(token, { attendance_method: 'WEB' })).status).toBe(200);
    await t.dataSource
      .getRepository(AcademicSessionEntity)
      .update({ organization_id: organization.id }, { start_date: '2020-01-01', end_date: '2020-12-31' });
    expect((await patchSettings(token, { attendance_method: 'OFF' })).status).toBe(200);
  });

  it("keeps a solo teacher's workspace to class attendance", async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    await enableAttendance(solo);
    const token = t.tokenFor(teacher);
    const presence = await patchSettings(token, { attendance_method: 'WEB' });
    expect(presence.status).toBe(400);
    expect(presence.body.code).toBe('ATTENDANCE_PRESENCE_NOT_FOR_SOLO');
    expect((await patchSettings(token, { class_attendance_mode: 'DAILY' })).body.payload.class_attendance_mode).toBe('DAILY');
  });

  it('rejects invalid values', async () => {
    const { token } = await school();
    const bad: unknown[] = [
      { weekly_off_days: [1, 2, 3, 4, 5, 6, 7] },
      { weekly_off_days: [0] },
      { weekly_off_days: [5, 5] },
      { student_entry_time: '9am' },
      { teacher_entry_time: '24:00' },
      { repeat_absence_days: 1 },
      { repeat_absence_days: 31 },
      { class_attendance_mode: 'WEEKLY' },
      { guardian_sms: { late: 'yes' } },
    ];
    for (const body of bad) expect([body, (await patchSettings(token, body)).status]).toEqual([body, 400]);

    const selfie = await patchSettings(token, { attendance_method: 'WEB', selfie_required: true });
    expect(selfie.status).toBe(400);
    expect(selfie.body.code).toBe('ATTENDANCE_SELFIE_NEEDS_APP');
    expect((await getSettings(token)).body.payload).toEqual(DEFAULTS);
  });

  it("never reads or changes another organisation's settings", async () => {
    const a = await school();
    const b = await school();
    await patchSettings(a.token, { weekly_off_days: [5, 6] });
    expect((await getSettings(b.token)).body.payload.weekly_off_days).toEqual([5]);

    // A's owner pointing at B's workspace is not a member there.
    const crossToken = orgSession(a.owner, b.organization);
    expect((await patchSettings(crossToken, { weekly_off_days: [7] })).status).toBe(403);
    expect((await getSettings(crossToken)).status).toBe(403);
    expect((await getSettings(b.token)).body.payload.weekly_off_days).toEqual([5]);
  });

  it('records each change in the audit log, only the fields that changed', async () => {
    const { owner, organization, token } = await school();
    await patchSettings(token, { weekly_off_days: [5, 6], repeat_absence_days: 3 });
    await patchSettings(token, { repeat_absence_days: 3 }); // no change, no row
    await audit.flush();
    const rows = await t.dataSource
      .getRepository(AuditLogEntity)
      .find({ where: { organization_id: organization.id, action: 'attendance_settings.update' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actor_id: owner.id,
      entity_type: 'org_settings',
      before: { weekly_off_days: [5] },
      after: { weekly_off_days: [5, 6] },
    });
  });
});
