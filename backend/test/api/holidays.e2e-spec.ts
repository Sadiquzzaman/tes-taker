import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { HolidaysService } from '../../src/calendar/holidays.service';
import { ActiveStatusEnum } from '../../src/common/enums/active-status.enum';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { addDays, isoDayOf, schoolDateIn } from '../../src/common/utils/school-date.util';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Holiday = { id: string; date_from: string; date_to: string; name: string | null; days: number };
type Body<T> = { payload: T; code?: string; feature?: string };

/** Holidays and closures (P3-01, CAL-04): days and ranges, soft removal, past days locked, gate, tenancy, audit, closed days. */
describe('holidays API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let admin: UserEntity;

  // School days are dates in the organisation's time zone (Asia/Dhaka by default).
  const today = () => schoolDateIn('Asia/Dhaka');
  const inDays = (n: number) => addDays(today(), n);

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  const list = (token: string, query = '') => t.api.get<Body<Holiday[]>>(`/holidays${query}`, token);
  const add = (token: string, body: unknown) => t.api.post<Body<Holiday>>('/holidays', body, token);
  const edit = (token: string, id: string, body: unknown) => t.api.request<Body<Holiday>>('PATCH', `/holidays/${id}`, { body, token });
  const remove = (token: string, id: string) => t.api.request<Body<null>>('DELETE', `/holidays/${id}`, { token });

  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) {
      const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
        body: { value: true, reason: 'P3-01 test' },
        token: t.tokenFor(admin),
      });
      expect(response.status).toBe(200);
    }
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

  it('adds single days and ranges with an optional note, listed in date order', async () => {
    const { token } = await school();
    const range = await add(token, { date_from: inDays(10), date_to: inDays(12), name: '  Winter break  ' });
    expect(range.status).toBe(201);
    expect(range.body.payload).toMatchObject({ date_from: inDays(10), date_to: inDays(12), name: 'Winter break', days: 3 });

    const single = await add(token, { date_from: inDays(3) });
    expect(single.body.payload).toMatchObject({ date_from: inDays(3), date_to: inDays(3), name: null, days: 1 });
    expect((await add(token, { date_from: today(), name: 'Closed today' })).status).toBe(201);

    const listed = (await list(token)).body.payload;
    expect(listed.map((h) => h.date_from)).toEqual([today(), inDays(3), inDays(10)]);
    // Only holidays overlapping the window.
    expect((await list(token, `?from=${inDays(11)}&to=${inDays(20)}`)).body.payload.map((h) => h.name)).toEqual(['Winter break']);
  });

  it('rejects bad dates, reversed or too-long ranges, and past days', async () => {
    const { token } = await school();
    const cases: Array<[unknown, number, string?]> = [
      [{ date_from: 'tomorrow' }, 400],
      [{ date_from: '2027-02-30' }, 400, 'HOLIDAY_INVALID_DATE'],
      [{ date_from: inDays(5), date_to: inDays(4) }, 400, 'HOLIDAY_RANGE_INVALID'],
      [{ date_from: inDays(1), date_to: inDays(121) }, 400, 'HOLIDAY_RANGE_TOO_LONG'],
      [{ date_from: inDays(-1) }, 400, 'HOLIDAY_PAST_LOCKED'],
      [{ date_from: inDays(1), name: 'x'.repeat(121) }, 400],
    ];
    for (const [body, status, code] of cases) {
      const response = await add(token, body);
      expect([body, response.status]).toEqual([body, status]);
      if (code) expect(response.body.code).toBe(code);
    }
    expect((await list(token)).body.payload).toEqual([]);
  });

  it('changes and removes upcoming holidays; removing keeps the row with who and when', async () => {
    const { owner, token } = await school();
    const { id } = (await add(token, { date_from: inDays(5), name: 'Sports day' })).body.payload;

    const changed = await edit(token, id, { date_to: inDays(6), name: '' });
    expect(changed.status).toBe(200);
    expect(changed.body.payload).toMatchObject({ date_from: inDays(5), date_to: inDays(6), name: null, days: 2 });
    expect((await edit(token, id, { date_from: inDays(-2) })).body.code).toBe('HOLIDAY_PAST_LOCKED');

    expect((await remove(token, id)).status).toBe(200);
    expect((await list(token)).body.payload).toEqual([]);
    const row = await t.dataSource.getRepository(HolidayEntity).findOneByOrFail({ id });
    expect(row).toMatchObject({ is_active: ActiveStatusEnum.INACTIVE, removed_by: owner.id });
    expect(row.removed_at).toBeInstanceOf(Date);
    // A removed holiday can be neither changed nor removed again.
    expect((await edit(token, id, { name: 'Again' })).status).toBe(404);
    expect((await remove(token, id)).status).toBe(404);
  });

  it('locks holidays that have already started', async () => {
    const { organization, token } = await school();
    const started = await t.dataSource.getRepository(HolidayEntity).save({
      organization_id: organization.id,
      date_from: inDays(-3),
      date_to: inDays(2),
      name: 'Eid',
      created_at: new Date(),
    });
    expect((await edit(token, started.id, { date_to: inDays(4) })).body.code).toBe('HOLIDAY_PAST_LOCKED');
    expect((await remove(token, started.id)).body.code).toBe('HOLIDAY_PAST_LOCKED');
    expect((await list(token)).body.payload.map((h) => h.id)).toEqual([started.id]);
  });

  it('lets everyone in the workspace see holidays; only the owner and admins change them', async () => {
    const { organization, token } = await school();
    const { id } = (await add(token, { date_from: inDays(2) })).body.payload;
    const adminToken = await memberOf(organization, OrganizationMemberRoleEnum.ADMIN);
    const teacherToken = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const studentToken = await memberOf(organization, OrganizationMemberRoleEnum.STUDENT);

    for (const reader of [teacherToken, studentToken]) {
      expect((await list(reader)).body.payload.map((h) => h.id)).toEqual([id]);
      expect((await add(reader, { date_from: inDays(4) })).status).toBe(403);
      expect((await edit(reader, id, { name: 'No' })).status).toBe(403);
      expect((await remove(reader, id)).status).toBe(403);
    }
    expect((await edit(adminToken, id, { name: 'By admin' })).status).toBe(200);
  });

  it('refuses holidays with FEATURE_NOT_IN_PLAN while the plan has no attendance', async () => {
    const { token } = await school({ enabled: false });
    for (const response of [await list(token), await add(token, { date_from: inDays(1) })]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN', feature: 'attendance' });
    }
  });

  it("never shows, changes or removes another organisation's holidays", async () => {
    const a = await school();
    const b = await school();
    const { id } = (await add(a.token, { date_from: inDays(2), name: 'A only' })).body.payload;

    expect((await list(b.token)).body.payload).toEqual([]);
    expect((await edit(b.token, id, { name: 'Hijacked' })).status).toBe(404);
    expect((await remove(b.token, id)).status).toBe(404);
    expect((await list(orgSession(b.owner, a.organization))).status).toBe(403);
    expect((await list(a.token)).body.payload).toMatchObject([{ id, name: 'A only' }]);
  });

  it('records additions, changes and removals in the audit log', async () => {
    const { owner, organization, token } = await school();
    const { id } = (await add(token, { date_from: inDays(7), name: 'Picnic' })).body.payload;
    await edit(token, id, { name: 'School picnic' });
    await remove(token, id);
    await audit.flush();
    const rows = await t.dataSource
      .getRepository(AuditLogEntity)
      .find({ where: { organization_id: organization.id, entity_id: id }, order: { created_at: 'ASC' } });
    expect(rows.map((r) => r.action).sort()).toEqual(['holiday.create', 'holiday.remove', 'holiday.update']);
    expect(rows.every((r) => r.actor_id === owner.id)).toBe(true);
    expect(rows.find((r) => r.action === 'holiday.update')).toMatchObject({ before: { name: 'Picnic' }, after: { name: 'School picnic' } });
  });

  it('works out closed days from the weekly off days and active holidays only', async () => {
    const { organization, token } = await school();
    await t.api.request('PATCH', '/attendance/settings', { body: { weekly_off_days: [5, 6] }, token });
    const from = inDays(1);
    const to = inDays(14);
    const { id: removed } = (await add(token, { date_from: inDays(2), name: 'Cancelled' })).body.payload;
    await remove(token, removed);
    await add(token, { date_from: inDays(3), date_to: inDays(4), name: 'Break' });

    const closed = await t.app.get(HolidaysService).closedDays(organization.id, from, to);
    const expected: Array<{ date: string; reason: string }> = [];
    for (let i = 1; i <= 14; i++) {
      const date = inDays(i);
      if (i === 3 || i === 4) expected.push({ date, reason: 'HOLIDAY' });
      else if ([5, 6].includes(isoDayOf(date))) expected.push({ date, reason: 'WEEKLY_OFF' });
    }
    expect(closed.map(({ date, reason }) => ({ date, reason }))).toEqual(expected);
  });
});
