import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { SessionClosingService } from '../../src/attendance/session-closing.service';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Change = {
  routine_start_time: string;
  routine_end_time: string;
  substitute: { id: string; full_name: string } | null;
  by: { id: string } | null;
  note: string | null;
} | null;
type Detail = {
  slot_id: string;
  start_time: string;
  end_time: string;
  teacher: { id: string; full_name: string } | null;
  change: Change;
  can_change: boolean;
  teachers: { person: { id: string }; status: string }[];
};
type MyClass = { slot_id: string; role: string; start_time: string; end_time: string; state: string; can_check_in: boolean };
type Body<T> = { payload: T; code?: string; message?: unknown; details?: Record<string, unknown> };

const SAT = 6;
const DATE = '2026-11-07';
const NEXT = '2026-11-14';
const PIN = { lat: 23.758, lng: 90.389 };
const near = { latitude: PIN.lat + 0.0001, longitude: PIN.lng, accuracy_m: 15 };

/**
 * One-day changes to a class (P5-04 part 3, CAL-01): other times that day and/or a substitute
 * teacher, saved on the class session ahead of time; check-in, the closing job and the class view
 * follow them, the rest of the routine does not change, and everyone involved is told in-app.
 */
describe('class changes API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const detail = (token: string, slotId: string, date = DATE) => call<Detail>('GET', `/attendance/sessions/${slotId}/${date}`, token);
  const change = (token: string, slotId: string, body: unknown, date = DATE) => call<Detail>('POST', `/attendance/sessions/${slotId}/${date}/change`, token, body);
  const today = (token: string) => call<{ classes: MyClass[] }>('GET', '/attendance/me/today', token);
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));

  /**
   * Class 8 A meets Saturdays 16:00–17:30 (Dhaka) with Rina and two students, and 18:00–19:00
   * with no teacher; Karim is another teacher of the school who does not teach Class 8.
   */
  const school = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P5-04 test' },
      token: t.tokenFor(admin),
    });
    expect(enabled.status).toBe(200);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 8' });
    const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
    const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
    const rina = await make.teacher({ personal_teacher_enabled: false, full_name: 'Rina Akter' });
    const karim = await make.teacher({ personal_teacher_enabled: false, full_name: 'Karim Uddin' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const students: { user: UserEntity; token: string }[] = [];
    for (const name of ['Rahim', 'Sumi']) {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      const enrolment = await make.enrol(classEntity, user);
      await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
      students.push({ user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) });
    }
    const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
    const main = branches.body.payload.find((b) => b.is_default) as { id: string };
    await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 });
    const saved = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
      slots: [
        { day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: rina.id },
        { day_of_week: SAT, start_time: '18:00', end_time: '19:00', teacher_id: null },
      ],
    });
    expect(saved.status).toBe(200);
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id = $1`, [section.id]);
    const slots = (await t.dataSource.query(`SELECT id, start_time FROM routine_slots WHERE section_id = $1 AND is_active = '1' ORDER BY start_time`, [section.id])) as {
      id: string;
    }[];
    return {
      organization,
      ownerToken,
      rina,
      karim,
      rinaToken: orgSession(rina, organization, OrganizationMemberRoleEnum.TEACHER),
      karimToken: orgSession(karim, organization, OrganizationMemberRoleEnum.TEACHER),
      students,
      section,
      afternoon: slots[0].id,
      evening: slots[1].id,
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

  it('moves one class to other times that day; check-in follows, the next week does not change, and students are told', async () => {
    const s = await school();
    setNow('2026-11-07T04:00:00Z'); // 10:00 in Dhaka
    const moved = await change(s.ownerToken, s.afternoon, { start_time: '14:00', end_time: '15:30', note: 'After the exam' });
    expect(moved.status).toBe(200);
    expect(moved.body.payload).toMatchObject({
      start_time: '14:00',
      end_time: '15:30',
      teacher: { id: s.rina.id },
      change: { routine_start_time: '16:00', routine_end_time: '17:30', substitute: null, note: 'After the exam' },
    });
    expect((await detail(s.ownerToken, s.afternoon, NEXT)).body.payload).toMatchObject({ start_time: '16:00', change: null });

    const notices = await t.dataSource
      .getRepository(NotificationOutboxEntity)
      .createQueryBuilder('o')
      .where('o.event_type = :type', { type: 'attendance.class_changed' })
      .andWhere('o.organization_id = :org', { org: s.organization.id })
      .getMany();
    expect(notices.map((n) => n.recipient_id).sort()).toEqual([...s.students.map((x) => x.user.id), s.rina.id].sort());

    // 13:50 in Dhaka: check-in for the moved class is open (it opens 15 minutes before 14:00).
    setNow('2026-11-07T07:50:00Z');
    const mine = (await today(s.students[0].token)).body.payload.classes.find((c) => c.slot_id === s.afternoon) as MyClass;
    expect(mine).toMatchObject({ start_time: '14:00', end_time: '15:30', state: 'OPEN', can_check_in: true });
    const checkIn = await call('POST', '/attendance/check-in', s.students[0].token, { slot_id: s.afternoon, ...near });
    expect(checkIn.status).toBe(200);

    // Once someone has checked in, the class can't change any more.
    setNow('2026-11-07T07:52:00Z');
    const tooLate = await change(s.ownerToken, s.afternoon, { start_time: '15:00', end_time: '16:00' });
    expect(tooLate.status).toBe(409);
    expect(tooLate.body.code).toBe('ATTENDANCE_CHANGE_STARTED');
  });

  it('gives one class a substitute: they check in and are marked Absent if they do not; the routine teacher is not expected', async () => {
    const s = await school();
    setNow('2026-11-07T04:00:00Z');
    // Karim does not teach Class 8, so the class is not his before the change.
    expect((await detail(s.karimToken, s.afternoon)).status).toBe(404);
    const covered = await change(s.rinaToken, s.afternoon, { substitute_teacher_id: s.karim.id });
    expect(covered.status).toBe(200);
    expect(covered.body.payload).toMatchObject({ start_time: '16:00', teacher: { id: s.karim.id, full_name: 'Karim Uddin' }, change: { substitute: { id: s.karim.id } } });
    expect((await detail(s.karimToken, s.afternoon)).status).toBe(200);
    expect((await detail(s.karimToken, s.afternoon, NEXT)).status).toBe(404);

    // 15:50 in Dhaka: Karim has the class today, Rina does not.
    setNow('2026-11-07T09:50:00Z');
    expect((await today(s.karimToken)).body.payload.classes.map((c) => [c.slot_id, c.role])).toEqual([[s.afternoon, 'TEACHER']]);
    expect((await today(s.rinaToken)).body.payload.classes.map((c) => c.slot_id)).toEqual([]);
    const refused = await call('POST', '/attendance/check-in', s.rinaToken, { slot_id: s.afternoon, ...near });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('ATTENDANCE_CHECKIN_NOT_YOUR_CLASS');

    // After the class nobody checked in: the closing job marks Karim Absent, not Rina.
    setNow('2026-11-07T12:00:00Z');
    await t.app.get(SessionClosingService).closeOrganization(s.organization.id, DATE);
    const teachers = await t.dataSource.getRepository(AttendanceRecordEntity).find({ where: { organization_id: s.organization.id, person_type: 'TEACHER' as never } });
    expect(teachers.map((r) => [r.person_id, r.status])).toEqual([[s.karim.id, 'ABSENT']]);
    const view = (await detail(s.ownerToken, s.afternoon)).body.payload;
    expect(view.teachers.map((row) => row.person.id)).toEqual([s.karim.id]);

    // Next week Rina teaches as usual.
    expect((await detail(s.ownerToken, s.afternoon, NEXT)).body.payload.teacher).toMatchObject({ id: s.rina.id });
  });

  it('refuses times that overlap the section, are past or incomplete, a non-teacher, and undoes a change', async () => {
    const s = await school();
    setNow('2026-11-07T04:00:00Z');
    const overlap = await change(s.ownerToken, s.afternoon, { start_time: '17:00', end_time: '18:30' });
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe('ATTENDANCE_CHANGE_OVERLAP');
    expect(overlap.body.details).toMatchObject({ slot_id: s.evening, start_time: '18:00', end_time: '19:00' });
    for (const body of [{ start_time: '09:00', end_time: '09:30' }, { start_time: '15:00' }, { start_time: '16:00', end_time: '15:00' }]) {
      const bad = await change(s.ownerToken, s.afternoon, body);
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('ATTENDANCE_CHANGE_TIME_INVALID');
    }
    const student = await change(s.ownerToken, s.afternoon, { substitute_teacher_id: s.students[0].user.id });
    expect(student.status).toBe(400);
    expect(student.body.code).toBe('ATTENDANCE_CHANGE_TEACHER_INVALID');
    expect((await change(s.students[0].token, s.afternoon, { start_time: '12:00', end_time: '13:00' })).status).toBe(403);

    expect((await change(s.ownerToken, s.afternoon, { start_time: '12:00', end_time: '13:00', substitute_teacher_id: s.karim.id })).status).toBe(200);
    const undone = await change(s.ownerToken, s.afternoon, { start_time: '16:00', end_time: '17:30', substitute_teacher_id: null });
    expect(undone.status).toBe(200);
    expect(undone.body.payload).toMatchObject({ start_time: '16:00', end_time: '17:30', teacher: { id: s.rina.id }, change: null });
    const nothing = await change(s.ownerToken, s.afternoon, { substitute_teacher_id: null });
    expect(nothing.status).toBe(400);
    expect(nothing.body.code).toBe('ATTENDANCE_CHANGE_NONE');

    await t.app.get(AuditService).flush();
    const audits = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'attendance.change' }, order: { created_at: 'ASC' } });
    expect(audits.map((row) => (row.after as { undone: boolean }).undone)).toEqual([false, true]);
  });
});
