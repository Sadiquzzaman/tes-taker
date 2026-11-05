import { DeepPartial } from 'typeorm';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type CalendarClass = { slot_id: string; role: string; section: { name: string; class_name: string }; start_time: string; end_time: string; status: string; record: { status: string } | null };
type Calendar = {
  month: string;
  today: string;
  time_zone: string;
  days: { date: string; closed: { reason: string } | null; classes: CalendarClass[] }[];
  counts: { present: number; late: number; absent: number; leave: number };
  attendance_pct: number | null;
};
type Body<T> = { payload: T; code?: string };

const SAT = 6;
const PIN = { lat: 23.758, lng: 90.389 };
const near = { latitude: PIN.lat + 0.0001, longitude: PIN.lng, accuracy_m: 15 };

/**
 * "My attendance" (P3-03, ATT-18): the month calendar of the caller's own classes in the agreed
 * colours (statuses), the counts and the attendance %, holidays, classes before joining, paper
 * registers, removed slots, only one's own records, the plan gate.
 */
describe('my attendance API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const calendar = (token: string, month = '2026-11') => call<Calendar>('GET', `/attendance/me/calendar${month ? `?month=${month}` : ''}`, token);
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const day = (view: Calendar, date: string) => view.days.find((d) => d.date === date) as Calendar['days'][number];

  /** A school whose section A meets Saturdays 16:00–17:30 (Dhaka), set up and joined on 1 Oct 2026. */
  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) {
      const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
        body: { value: true, reason: 'P3-03 test' },
        token: t.tokenFor(admin),
      });
      expect(response.status).toBe(200);
    }
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 8' });
    const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
    const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
    const student = await make.student();
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    const enrolment = await make.enrol(classEntity, student);
    await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
    if (enabled) {
      const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
      const main = branches.body.payload.find((b) => b.is_default) as { id: string };
      await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 });
      expect(
        (await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, { slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30' }] })).status,
      ).toBe(200);
      await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id = $1`, [section.id]);
    }
    const [slot] = (await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1'`, [section.id])) as { id: string }[];
    return {
      organization,
      ownerToken,
      section,
      classEntity,
      enrolment,
      slotId: slot?.id,
      student,
      studentToken: orgSession(student, organization, OrganizationMemberRoleEnum.STUDENT),
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it('shows each class of the month with its status, the counts and the attendance %', async () => {
    const { organization, studentToken, slotId } = await school();
    await t.dataSource.getRepository(HolidayEntity).save({
      organization_id: organization.id,
      date_from: '2026-11-21',
      date_to: '2026-11-21',
      name: 'Holiday',
    } as DeepPartial<HolidayEntity>);

    // Sat 7 Nov: checked in at 16:20 (Late). Sat 14 Nov: no check-in.
    setNow('2026-11-07T10:20:00Z');
    expect((await call('POST', '/attendance/check-in', studentToken, { slot_id: slotId, ...near })).status).toBe(200);

    setNow('2026-11-14T10:05:00Z');
    let view = (await calendar(studentToken)).body.payload;
    expect(day(view, '2026-11-14').classes[0].status).toBe('OPEN');

    setNow('2026-11-14T12:00:00Z');
    const response = await calendar(studentToken);
    expect(response.status).toBe(200);
    view = response.body.payload;
    expect(view).toMatchObject({ month: '2026-11', today: '2026-11-14', time_zone: 'Asia/Dhaka' });
    expect(view.days).toHaveLength(30);
    const statuses = view.days.filter((d) => d.classes.length > 0).map((d) => `${d.date} ${d.classes.map((c) => c.status).join()}`);
    expect(statuses).toEqual(['2026-11-07 LATE', '2026-11-14 ABSENT', '2026-11-21 CLOSED_DAY', '2026-11-28 UPCOMING']);
    expect(day(view, '2026-11-07').classes[0]).toMatchObject({ role: 'STUDENT', section: { name: 'A', class_name: 'Class 8' }, start_time: '16:00', end_time: '17:30', record: { status: 'LATE' } });
    expect(day(view, '2026-11-21').closed).toMatchObject({ reason: 'HOLIDAY' });
    expect(day(view, '2026-11-06').closed).toMatchObject({ reason: 'WEEKLY_OFF' });
    expect(view.counts).toEqual({ present: 0, late: 1, absent: 1, leave: 0 });
    expect(view.attendance_pct).toBe(50);

    // Another month, and the default month.
    expect((await calendar(studentToken, '2026-12')).body.payload.days).toHaveLength(31);
    expect((await calendar(studentToken, '')).body.payload.month).toBe('2026-11');
  });

  it('shows only classes from the day the student joined and the slot was added', async () => {
    const { studentToken, enrolment } = await school();
    await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-11-10T00:00:00Z' WHERE id = $1`, [enrolment.id]);
    setNow('2026-11-14T12:00:00Z');
    const view = (await calendar(studentToken)).body.payload;
    expect(view.days.filter((d) => d.classes.length > 0).map((d) => d.date)).toEqual(['2026-11-14', '2026-11-21', '2026-11-28']);
    expect(view.attendance_pct).toBe(0);
  });

  it('shows a paper-register class without its register as not recorded, never as absent', async () => {
    const { ownerToken, studentToken, section } = await school();
    expect((await call('PATCH', `/attendance/setup/sections/${section.id}`, ownerToken, { mode: 'PAPER_REGISTER' })).status).toBe(200);
    setNow('2026-11-14T12:00:00Z');
    const view = (await calendar(studentToken)).body.payload;
    expect(day(view, '2026-11-07').classes[0].status).toBe('NOT_RECORDED');
    expect(view.counts).toEqual({ present: 0, late: 0, absent: 0, leave: 0 });
    expect(view.attendance_pct).toBeNull();
  });

  it('keeps a record after its slot is removed from the schedule', async () => {
    const { ownerToken, studentToken, slotId, section } = await school();
    setNow('2026-11-07T10:00:00Z');
    expect((await call('POST', '/attendance/check-in', studentToken, { slot_id: slotId, ...near })).status).toBe(200);
    expect(
      (await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, { slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }] })).status,
    ).toBe(200);
    setNow('2026-11-14T12:00:00Z');
    const view = (await calendar(studentToken)).body.payload;
    expect(day(view, '2026-11-07').classes).toMatchObject([{ slot_id: slotId, status: 'PRESENT', start_time: '16:00', end_time: '17:30' }]);
    expect(day(view, '2026-11-14').classes).toEqual([]);
  });

  it("shows only the caller's own records, refuses a bad month and a plan without attendance", async () => {
    const a = await school();
    setNow('2026-11-07T10:00:00Z');
    expect((await call('POST', '/attendance/check-in', a.studentToken, { slot_id: a.slotId, ...near })).status).toBe(200);
    const classmate = await make.student();
    await make.member(a.organization, classmate, OrganizationMemberRoleEnum.STUDENT);
    const enrolment = await make.enrol(a.classEntity, classmate);
    await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
    setNow('2026-11-07T12:00:00Z');
    const theirs = (await calendar(orgSession(classmate, a.organization, OrganizationMemberRoleEnum.STUDENT))).body.payload;
    expect(day(theirs, '2026-11-07').classes).toMatchObject([{ status: 'ABSENT', record: null }]);

    const bad = await calendar(a.studentToken, '2026-13');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('ATTENDANCE_CALENDAR_MONTH_INVALID');

    const off = await school({ enabled: false });
    const gated = await calendar(off.studentToken);
    expect(gated.status).toBe(403);
    expect(gated.body.code).toBe('FEATURE_NOT_IN_PLAN');
  });
});
