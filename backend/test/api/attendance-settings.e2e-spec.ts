import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Settings = {
  late_grace_minutes: number;
  weekly_off_days: number[];
  guardian_sms: { late: boolean; absent: boolean; leave: boolean };
  repeat_absence_days: number;
};
type Body<T> = { payload: T; code?: string; feature?: string; message?: string };

const DEFAULTS: Settings = {
  late_grace_minutes: 10,
  weekly_off_days: [5],
  guardian_sms: { late: true, absent: true, leave: true },
  repeat_absence_days: 3,
};

/**
 * Attendance settings (P3-01, ATT-01 as changed on 5 Nov 2026 in P3-02): defaults, who reads and
 * changes them, the rules, the plan gate, tenancy and audit.
 */
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
    for (const response of [await getSettings(token), await patchSettings(token, { late_grace_minutes: 5 })]) {
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
      late_grace_minutes: 15,
      weekly_off_days: [6, 5],
      guardian_sms: { late: false },
      repeat_absence_days: 5,
    });
    expect(saved.status).toBe(200);
    const expected = {
      ...DEFAULTS,
      late_grace_minutes: 15,
      weekly_off_days: [5, 6],
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

  it("no longer takes P3-01's presence method, selfie, class mode or entry times, whose columns are gone", async () => {
    const { organization, token } = await school();
    const response = await patchSettings(token, {
      attendance_method: 'WEB',
      selfie_required: true,
      class_attendance_mode: 'DAILY',
      student_entry_time: '08:30',
      teacher_entry_time: '08:15',
      confirm_method_change: true,
      late_grace_minutes: 0,
    });
    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual({ ...DEFAULTS, late_grace_minutes: 0 });
    // Dropped after the P3-02 release (expand → contract, owner approval 6 Nov 2026).
    const columns = await t.dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'org_settings' AND column_name = ANY($1)`,
      [['attendance_method', 'selfie_required', 'class_attendance_mode', 'student_entry_time', 'teacher_entry_time']],
    );
    expect(columns).toEqual([]);
    const [row] = await t.dataSource.query(`SELECT late_grace_minutes FROM org_settings WHERE organization_id = $1`, [organization.id]);
    expect(row).toEqual({ late_grace_minutes: 0 });
  });

  it("lets a solo teacher set the grace period and off days of their workspace", async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    await enableAttendance(solo);
    const token = t.tokenFor(teacher);
    const response = await patchSettings(token, { late_grace_minutes: 20, weekly_off_days: [5, 6] });
    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual({ ...DEFAULTS, late_grace_minutes: 20, weekly_off_days: [5, 6] });
  });

  it('rejects invalid values', async () => {
    const { token } = await school();
    const bad: unknown[] = [
      { weekly_off_days: [1, 2, 3, 4, 5, 6, 7] },
      { weekly_off_days: [0] },
      { weekly_off_days: [5, 5] },
      { late_grace_minutes: -1 },
      { late_grace_minutes: 61 },
      { late_grace_minutes: 2.5 },
      { repeat_absence_days: 1 },
      { repeat_absence_days: 31 },
      { guardian_sms: { late: 'yes' } },
    ];
    for (const body of bad) expect([body, (await patchSettings(token, body)).status]).toEqual([body, 400]);
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
