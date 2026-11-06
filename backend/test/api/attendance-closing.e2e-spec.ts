import { DeepPartial } from 'typeorm';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../src/attendance/entities/class-session.entity';
import { SessionClosingService } from '../../src/attendance/session-closing.service';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Summary = {
  slot_id: string;
  state: string;
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number };
  cancelled: { note: string | null; by: { id: string } | null } | null;
  can_correct: boolean;
  can_cancel: boolean;
  can_restore: boolean;
};
type Detail = Summary & { students: { person: { id: string }; status: string }[]; teachers: { person: { id: string }; status: string }[] };
type Body<T> = { payload: T; code?: string };

const SAT = 6;
const DATE = '2026-11-07'; // a Saturday; the class is 16:00–17:30 in Dhaka (10:00–11:30 UTC)
const AFTER = `${DATE}T12:00:00Z`;
const PIN = { lat: 23.758, lng: 90.389 };
const near = { latitude: PIN.lat + 0.0001, longitude: PIN.lng, accuracy_m: 15 };

/**
 * The closing job (P3-04, ATT-10) and class cancellation (ATT-19): Absent saved for everyone without
 * a check-in once check-in closes, run twice or after the worker was down, never on closed days,
 * cancelled or paper-register classes, for slots added or students who joined after the class
 * started; cancelling and restoring a class with its rules, notices and audit; the teachers'
 * correction limit; tenancy and the plan gate.
 */
describe('attendance closing job and class cancellation', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let closing: SessionClosingService;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const detail = (token: string, slotId: string, date = DATE) => call<Detail>('GET', `/attendance/sessions/${slotId}/${date}`, token);
  const cancel = (token: string, slotId: string, date = DATE, note?: string) =>
    call<Detail>('POST', `/attendance/sessions/${slotId}/${date}/cancel`, token, note === undefined ? {} : { note });
  const restore = (token: string, slotId: string, date = DATE) => call<Detail>('POST', `/attendance/sessions/${slotId}/${date}/restore`, token);
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const records = (organizationId: string) =>
    t.dataSource.getRepository(AttendanceRecordEntity).find({ where: { organization_id: organizationId }, order: { date: 'ASC', person_id: 'ASC' } });
  const sessionsOf = (organizationId: string) =>
    t.dataSource.getRepository(ClassSessionEntity).find({ where: { organization_id: organizationId }, order: { date: 'ASC' } });

  const enable = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-04 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school: Class 8 A meets Saturdays 16:00–17:30 with a named teacher and two students (Rahim and
   * Karim, joined 1 Oct); Class 9 A meets at the same time with no teacher named and one student.
   */
  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await enable(organization);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const newSection = async (name: string) => {
      const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: name });
      const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
      const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
      return { classEntity, section };
    };
    const c8 = await newSection('Class 8');
    const c9 = await newSection('Class 9');
    const teacher = await make.teacher({ personal_teacher_enabled: false, full_name: 'Rina Akter' });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const student = async (name: string, classEntity: ClassEntity, joined = '2026-10-01T00:00:00Z') => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      const enrolment = await make.enrol(classEntity, user);
      await t.dataSource.query(`UPDATE enrolments SET joined_at = $2 WHERE id = $1`, [enrolment.id, joined]);
      return { user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) };
    };
    const rahim = await student('Rahim', c8.classEntity);
    const karim = await student('Karim', c8.classEntity);
    const nila = await student('Nila', c9.classEntity);
    const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
    const main = branches.body.payload.find((b) => b.is_default) as { id: string };
    await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 });
    for (const [section, teacherId] of [[c8.section, teacher.id], [c9.section, null]] as const) {
      const saved = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
        slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: teacherId }],
      });
      expect(saved.status).toBe(200);
    }
    // Set up a week before the dates the tests look at (the closing job looks 7 days back).
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-11-01 00:00:00' WHERE section_id IN ($1, $2)`, [c8.section.id, c9.section.id]);
    if (!enabled) {
      await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
        body: { value: false, reason: 'P3-04 test' },
        token: t.tokenFor(admin),
      });
    }
    const slotOf = async (sectionId: string) =>
      ((await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1'`, [sectionId])) as { id: string }[])[0].id;
    return {
      owner,
      organization,
      ownerToken,
      teacher,
      teacherToken: orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER),
      rahim,
      karim,
      nila,
      student,
      c8,
      c9,
      slot8: await slotOf(c8.section.id),
      slot9: await slotOf(c9.section.id),
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    closing = t.app.get(SessionClosingService);
    audit = t.app.get(AuditService);
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

  describe('closing job (ATT-10)', () => {
    it('saves Absent for everyone without a check-in once check-in closes, keeps check-ins, and closes the session', async () => {
      const s = await school();
      setNow(`${DATE}T10:05:00Z`);
      expect((await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, ...near })).status).toBe(200);

      // Still open: nothing is saved yet.
      setNow(`${DATE}T11:29:00Z`);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 0, students_absent: 0, teachers_absent: 0, on_leave: 0 });

      setNow(AFTER);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 2, students_absent: 2, teachers_absent: 1, on_leave: 0 });
      const saved = await records(s.organization.id);
      const byPerson = new Map(saved.map((r) => [r.person_id, r]));
      expect(byPerson.get(s.rahim.user.id)).toMatchObject({ status: 'PRESENT', source: 'SELF' });
      expect(byPerson.get(s.karim.user.id)).toMatchObject({ status: 'ABSENT', source: 'AUTO_ABSENT', person_type: 'STUDENT', checked_in_at: null });
      expect(byPerson.get(s.nila.user.id)).toMatchObject({ status: 'ABSENT', source: 'AUTO_ABSENT' });
      // The named teacher of Class 8 A did not check in either (ATT-11).
      expect(byPerson.get(s.teacher.id)).toMatchObject({ status: 'ABSENT', source: 'AUTO_ABSENT', person_type: 'TEACHER' });
      const sessions = await sessionsOf(s.organization.id);
      expect(sessions.map((x) => x.status)).toEqual(['CLOSED', 'CLOSED']);
      expect(sessions.every((x) => x.closed_at instanceof Date)).toBe(true);

      // The views do not change: the Absent they showed is now saved.
      const view = await detail(s.ownerToken, s.slot8);
      expect(view.body.payload.counts).toMatchObject({ present: 1, absent: 1, waiting: 0 });
      expect(view.body.payload.can_correct).toBe(true);

      // The counts are in the audit log, as a system action.
      await audit.flush();
      const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'attendance.auto_absent' } });
      expect(logs).toHaveLength(1);
      expect(logs[0].actor_id).toBeNull();
      expect(logs[0].after).toMatchObject({ sessions_closed: 2, students_absent: 2, teachers_absent: 1, from: '2026-10-31', to: DATE });
    });

    it('running twice (or at the same time) saves nothing twice', async () => {
      const s = await school();
      setNow(AFTER);
      const [first, second] = await Promise.all([closing.closeOrganization(s.organization.id), closing.closeOrganization(s.organization.id)]);
      expect(first.students_absent + second.students_absent).toBe(3);
      expect(first.sessions_closed + second.sessions_closed).toBe(2);
      const before = await records(s.organization.id);
      expect(before).toHaveLength(4);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 0, students_absent: 0, teachers_absent: 0, on_leave: 0 });
      expect(await records(s.organization.id)).toEqual(before);

      // A correction after closing is kept by later runs.
      const corrected = await call('PUT', `/attendance/sessions/${s.slot8}/${DATE}/records/${s.karim.user.id}`, s.ownerToken, { status: 'PRESENT', reason: 'Was in class' });
      expect(corrected.status).toBe(200);
      await closing.closeOrganization(s.organization.id);
      expect((await records(s.organization.id)).find((r) => r.person_id === s.karim.user.id)).toMatchObject({ status: 'PRESENT', source: 'CORRECTION' });
    });

    it('catches up on the last 7 days after the worker was down, and no further', async () => {
      const s = await school();
      // The worker comes back on Saturday 21 Nov after the class: 14 and 21 Nov are within 7 days, 7 Nov is not.
      setNow('2026-11-21T12:00:00Z');
      const result = await closing.closeOrganization(s.organization.id);
      expect(result.sessions_closed).toBe(4);
      const dates = [...new Set((await records(s.organization.id)).map((r) => r.date))];
      expect(dates).toEqual(['2026-11-14', '2026-11-21']);
    });

    it('skips holidays, weekly off days, cancelled classes and paper-register sections', async () => {
      const s = await school();
      // 7 Nov is a holiday; 14 Nov: Class 8 A cancelled, Class 9 A on paper. 21 Nov is a normal day.
      await t.dataSource.getRepository(HolidayEntity).save({ organization_id: s.organization.id, date_from: DATE, date_to: DATE, name: 'Closed' } as DeepPartial<HolidayEntity>);
      setNow('2026-11-14T09:00:00Z');
      expect((await cancel(s.teacherToken, s.slot8, '2026-11-14', 'Unwell')).status).toBe(200);
      expect((await call('PATCH', `/attendance/setup/sections/${s.c9.section.id}`, s.ownerToken, { mode: 'PAPER_REGISTER' })).status).toBe(200);
      setNow('2026-11-14T12:00:00Z');
      expect((await closing.closeOrganization(s.organization.id)).sessions_closed).toBe(0);
      expect(await records(s.organization.id)).toEqual([]);
      expect((await sessionsOf(s.organization.id)).map((x) => [x.date, x.status])).toEqual([['2026-11-14', 'CANCELLED']]);

      // Saturday as a weekly off day: no class, no Absent.
      expect((await call('PATCH', '/attendance/settings', s.ownerToken, { weekly_off_days: [5, 6] })).status).toBe(200);
      setNow('2026-11-21T12:00:00Z');
      expect((await closing.closeOrganization(s.organization.id)).sessions_closed).toBe(0);
      expect((await call('PATCH', '/attendance/settings', s.ownerToken, { weekly_off_days: [5] })).status).toBe(200);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 1, students_absent: 2, teachers_absent: 1, on_leave: 0 });
    });

    it('marks nobody Absent for a slot added after the class started, nor students who joined after it started', async () => {
      const s = await school();
      // Karim joined during the class; Nila's section got its slot during the class.
      await t.dataSource.query(`UPDATE enrolments SET joined_at = $2 WHERE student_id = $1`, [s.karim.user.id, `${DATE}T10:30:00Z`]);
      // routine_slots.created_at has no time zone: pass a Date so it is stored like the API stores it.
      await t.dataSource.query(`UPDATE routine_slots SET created_at = $2 WHERE id = $1`, [s.slot9, new Date(`${DATE}T10:15:00Z`)]);
      setNow(AFTER);
      expect(await closing.closeOrganization(s.organization.id)).toEqual({ sessions_closed: 1, students_absent: 1, teachers_absent: 1, on_leave: 0 });
      expect((await records(s.organization.id)).map((r) => r.person_id).sort()).toEqual([s.rahim.user.id, s.teacher.id].sort());

      // The views agree: Karim is not on the class list, Nila has no class that day.
      const view = await detail(s.ownerToken, s.slot8);
      expect(view.body.payload.students.map((row) => row.person.id)).toEqual([s.rahim.user.id]);
      const nila = await call<{ days: { date: string; classes: unknown[] }[] }>('GET', '/attendance/me/calendar?month=2026-11', s.nila.token);
      expect(nila.body.payload.days.find((d) => d.date === DATE)?.classes).toEqual([]);
    });

    it('runs only for organisations with the attendance feature, and only on their own classes', async () => {
      const on = await school();
      const off = await school({ enabled: false });
      setNow(AFTER);
      const total = await closing.closeEnded();
      expect(total.organizations).toBeGreaterThanOrEqual(1);
      expect(await records(off.organization.id)).toEqual([]);
      expect((await records(on.organization.id)).length).toBe(4);
      expect((await records(on.organization.id)).every((r) => r.organization_id === on.organization.id)).toBe(true);
    });
  });

  describe('cancelling one class (ATT-19)', () => {
    it("lets the section's teacher cancel with a note: students are told in-app, nobody is Absent, check-in is refused", async () => {
      const s = await school();
      setNow(`${DATE}T08:00:00Z`);
      const response = await cancel(s.teacherToken, s.slot8, DATE, 'I am unwell; we will make it up on Monday');
      expect(response.status).toBe(200);
      expect(response.body.payload).toMatchObject({
        cancelled: { note: 'I am unwell; we will make it up on Monday', by: { id: s.teacher.id } },
        can_cancel: false,
        can_restore: true,
        can_correct: false,
      });
      expect(response.body.payload.students.map((row) => row.status)).toEqual(['CANCELLED', 'CANCELLED']);

      const notices = await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { organization_id: s.organization.id, event_type: 'attendance.class_cancelled' } });
      expect(notices.map((n) => n.recipient_id).sort()).toEqual([s.rahim.user.id, s.karim.user.id].sort());
      expect(notices.every((n) => n.channel === 'IN_APP')).toBe(true);
      expect(notices[0].payload).toMatchObject({ class_name: 'Class 8 A', class_on: DATE, start_time: '16:00', path: '/my-attendance' });

      setNow(`${DATE}T10:05:00Z`);
      const checkIn = await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, ...near });
      expect(checkIn.status).toBe(409);
      expect(checkIn.body.code).toBe('ATTENDANCE_CHECKIN_CANCELLED');
      const today = await call<{ classes: { slot_id: string; blocked: string | null }[] }>('GET', '/attendance/me/today', s.rahim.token);
      expect(today.body.payload.classes.find((c) => c.slot_id === s.slot8)?.blocked).toBe('CANCELLED');

      setNow(AFTER);
      await closing.closeOrganization(s.organization.id);
      expect((await records(s.organization.id)).map((r) => r.person_id)).toEqual([s.nila.user.id]);
      const calendar = await call<{ days: { date: string; classes: { status: string }[] }[]; counts: { absent: number } }>('GET', '/attendance/me/calendar?month=2026-11', s.karim.token);
      expect(calendar.body.payload.days.find((d) => d.date === DATE)?.classes.map((c) => c.status)).toEqual(['CANCELLED']);
      expect(calendar.body.payload.counts.absent).toBe(0);
      // A cancelled class is not corrected.
      const correction = await call('PUT', `/attendance/sessions/${s.slot8}/${DATE}/records/${s.karim.user.id}`, s.ownerToken, { status: 'PRESENT', reason: 'Was there' });
      expect(correction.body.code).toBe('ATTENDANCE_CORRECTION_CANCELLED');

      await audit.flush();
      const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'attendance.cancel' } });
      expect(logs).toHaveLength(1);
      expect(logs[0].actor_id).toBe(s.teacher.id);
      expect(logs[0].after).toMatchObject({ status: 'CANCELLED', date: DATE, slot_id: s.slot8 });
    });

    it('restores a cancelled class before it ends; it is then closed as usual', async () => {
      const s = await school();
      setNow(`${DATE}T08:00:00Z`);
      expect((await cancel(s.ownerToken, s.slot8)).status).toBe(200);
      const restored = await restore(s.teacherToken, s.slot8);
      expect(restored.status).toBe(200);
      expect(restored.body.payload).toMatchObject({ cancelled: null, can_cancel: true, can_restore: false });
      expect((await restore(s.teacherToken, s.slot8)).body.code).toBe('ATTENDANCE_CANCEL_NOT_CANCELLED');
      const notices = await t.dataSource.getRepository(NotificationOutboxEntity).count({ where: { organization_id: s.organization.id, event_type: 'attendance.class_restored' } });
      expect(notices).toBe(2);
      // Cancelling again tells the students again.
      expect((await cancel(s.ownerToken, s.slot8)).status).toBe(200);
      expect(await t.dataSource.getRepository(NotificationOutboxEntity).count({ where: { organization_id: s.organization.id, event_type: 'attendance.class_cancelled' } })).toBe(4);
      expect((await restore(s.ownerToken, s.slot8)).status).toBe(200);

      setNow(AFTER);
      expect((await restore(s.ownerToken, s.slot8)).body.code).toBe('ATTENDANCE_CANCEL_NOT_CANCELLED');
      await closing.closeOrganization(s.organization.id);
      expect((await records(s.organization.id)).filter((r) => r.status === 'ABSENT')).toHaveLength(4);
      await audit.flush();
      expect(await t.dataSource.getRepository(AuditLogEntity).count({ where: { organization_id: s.organization.id, action: 'attendance.restore' } })).toBe(2);
    });

    it('refuses past, ended, closed-day, too-far and repeated cancellations, and a cancelled class cannot be restored after it ends', async () => {
      const s = await school();
      const day = '2026-11-14';
      setNow(`${day}T10:30:00Z`); // during Saturday 14 Nov's class
      expect((await cancel(s.ownerToken, s.slot8, DATE)).body.code).toBe('ATTENDANCE_CANCEL_PAST');
      expect((await cancel(s.ownerToken, s.slot8, '2027-01-16')).body.code).toBe('ATTENDANCE_CANCEL_TOO_FAR');
      // A future class (60 days ahead at most) can be cancelled before its session row exists.
      const ahead = await cancel(s.ownerToken, s.slot8, '2027-01-09');
      expect(ahead.status).toBe(200);
      expect((await cancel(s.ownerToken, s.slot8, '2027-01-09')).body.code).toBe('ATTENDANCE_CANCEL_ALREADY');
      await t.dataSource.getRepository(HolidayEntity).save({ organization_id: s.organization.id, date_from: '2026-11-21', date_to: '2026-11-21', name: 'Closed' } as DeepPartial<HolidayEntity>);
      expect((await cancel(s.ownerToken, s.slot8, '2026-11-21')).body.code).toBe('ATTENDANCE_CANCEL_CLOSED_DAY');
      // During the class it can still be cancelled; once it has ended, not.
      expect((await cancel(s.ownerToken, s.slot8, day)).status).toBe(200);
      setNow(`${day}T12:00:00Z`);
      expect((await cancel(s.ownerToken, s.slot9, day)).body.code).toBe('ATTENDANCE_CANCEL_ENDED');
      expect((await restore(s.ownerToken, s.slot8, day)).body.code).toBe('ATTENDANCE_CANCEL_ENDED');
    });

    it('only staff who may see the class cancel it; another organisation never can', async () => {
      const s = await school();
      const other = await school();
      setNow(`${DATE}T08:00:00Z`);
      // The teacher teaches Class 8 A only (named on its slot); Class 9 A is not theirs.
      expect((await cancel(s.teacherToken, s.slot9)).status).toBe(404);
      expect((await cancel(s.rahim.token, s.slot8)).status).toBe(403);
      expect((await cancel(other.ownerToken, s.slot8)).status).toBe(404);
      expect((await restore(other.ownerToken, s.slot8)).status).toBe(404);
      expect(await sessionsOf(s.organization.id)).toEqual([]);
    });

    it('is not available without the attendance feature', async () => {
      const s = await school({ enabled: false });
      setNow(`${DATE}T08:00:00Z`);
      const response = await cancel(s.ownerToken, s.slot8);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FEATURE_NOT_IN_PLAN');
    });
  });

  describe('correction limit for teachers', () => {
    it('lets teachers correct the last 7 days only; owners and admins have no limit', async () => {
      const s = await school();
      setNow('2026-11-15T06:00:00Z'); // Sunday 15 Nov: 7 Nov is 8 days ago
      const old = await call('PUT', `/attendance/sessions/${s.slot8}/${DATE}/records/${s.karim.user.id}`, s.teacherToken, { status: 'PRESENT', reason: 'Was in class' });
      expect(old.status).toBe(409);
      expect(old.body.code).toBe('ATTENDANCE_CORRECTION_TOO_OLD');
      expect((await detail(s.teacherToken, s.slot8)).body.payload.can_correct).toBe(false);
      expect((await detail(s.ownerToken, s.slot8)).body.payload.can_correct).toBe(true);
      expect((await call('PUT', `/attendance/sessions/${s.slot8}/${DATE}/records/${s.karim.user.id}`, s.ownerToken, { status: 'PRESENT', reason: 'Was in class' })).status).toBe(200);

      setNow('2026-11-14T06:00:00Z'); // 7 days later: still within the limit
      expect((await call('PUT', `/attendance/sessions/${s.slot8}/${DATE}/records/${s.rahim.user.id}`, s.teacherToken, { status: 'LATE', late_minutes: 5, reason: 'Came in late' })).status).toBe(200);
    });
  });
});
