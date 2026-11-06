import { DeepPartial } from 'typeorm';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../src/attendance/entities/class-session.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationKindEnum } from '../../src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type RecordView = { id: string; status: string; checked_in_at: string | null; late_minutes: number | null; source: string; distance_m: number | null; accuracy_m: number | null; flag: string | null };
type ClassView = {
  slot_id: string;
  date: string;
  role: string;
  section: { id: string; name: string; class_name: string };
  class_type: string;
  mode: string;
  opens_at: string;
  starts_at: string;
  late_after: string;
  ends_at: string;
  state: string;
  needs_location: boolean;
  blocked: string | null;
  can_check_in: boolean;
  record: RecordView | null;
};
type Today = { date: string; server_time: string; time_zone: string; closed: { date: string; reason: string } | null; classes: ClassView[] };
type Body<T> = { payload: T; code?: string; details?: Record<string, unknown> & { record?: RecordView } };

/** Saturday 7 Nov 2026 in Dhaka (UTC+6). The batch meets Saturdays 16:00–17:30 = 10:00–11:30 UTC. */
const SAT = 6;
const at = (utc: string) => new Date(`2026-11-07T${utc}Z`);
const PIN = { lat: 23.758, lng: 90.389 };
/** About 111 m north of the pin per 0.001°. */
const north = (metres: number) => ({ latitude: PIN.lat + (metres / 111_195), longitude: PIN.lng });

/**
 * Web self check-in (P3-03; ATT-04, ATT-06, ATT-11): the window and its edges, Late after the
 * grace period, the branch radius and GPS accuracy, online classes, one check-in per class,
 * holidays and off days, paper registers, teachers, tenancy, permissions and the plan gate.
 */
describe('class check-in API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const today = (token: string) => call<Today>('GET', '/attendance/me/today', token);
  const checkIn = (token: string, body: Record<string, unknown>) => call<ClassView>('POST', '/attendance/check-in', token, body);
  const setNow = (instant: Date) => jest.spyOn(clock, 'now').mockReturnValue(instant);

  const enableAttendance = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-03 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school with one class and section (A) meeting Saturdays 16:00–17:30, a pin with a 100 m radius
   * on the main branch, a student enrolled in it and a teacher named on the slot.
   */
  const school = async ({ enabled = true, pin = true, slots = [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30' }] } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) await enableAttendance(organization);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 8' });
    expect(created.status).toBe(201);
    const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
    const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });

    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const student = await make.student();
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    await make.enrol(classEntity, student);

    if (enabled) {
      if (pin) {
        const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
        const main = branches.body.payload.find((b) => b.is_default) as { id: string };
        expect((await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 })).status).toBe(200);
      }
      const saved = await call<{ slots: { id: string }[] }>('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
        slots: slots.map((slot) => ({ ...slot, teacher_id: teacher.id })),
      });
      expect(saved.status).toBe(200);
    }
    const slotId = enabled ? ((await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1' ORDER BY start_time`, [section.id])) as { id: string }[])[0]?.id : '';
    return {
      owner,
      organization,
      ownerToken,
      classEntity,
      section,
      slotId,
      teacher,
      teacherToken: orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER),
      student,
      studentToken: orgSession(student, organization, OrganizationMemberRoleEnum.STUDENT),
    };
  };

  const setup = (token: string, sectionId: string, body: unknown) => call('PATCH', `/attendance/setup/sections/${sectionId}`, token, body);

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

  it("lists today's class with the window from the server's clock in the organisation's time zone", async () => {
    const { studentToken, slotId, section } = await school();
    setNow(at('09:30:00'));
    const response = await today(studentToken);
    expect(response.status).toBe(200);
    const view = response.body.payload;
    expect(view).toMatchObject({ date: '2026-11-07', server_time: '2026-11-07T09:30:00.000Z', time_zone: 'Asia/Dhaka', closed: null });
    expect(view.classes).toHaveLength(1);
    expect(view.classes[0]).toMatchObject({
      slot_id: slotId,
      role: 'STUDENT',
      section: { id: section.id, name: 'A', class_name: 'Class 8' },
      class_type: 'IN_PERSON',
      start_time: '16:00',
      end_time: '17:30',
      opens_at: '2026-11-07T09:45:00.000Z',
      starts_at: '2026-11-07T10:00:00.000Z',
      late_after: '2026-11-07T10:10:00.000Z',
      ends_at: '2026-11-07T11:30:00.000Z',
      state: 'UPCOMING',
      needs_location: true,
      blocked: null,
      can_check_in: false,
      record: null,
    });

    // Sunday: the class does not meet.
    setNow(new Date('2026-11-08T10:00:00Z'));
    expect((await today(studentToken)).body.payload.classes).toEqual([]);
  });

  it('refuses before the window opens and after it closes, and opens 15 minutes before the start', async () => {
    const { studentToken, slotId } = await school();
    const inside = { slot_id: slotId, ...north(10), accuracy_m: 20 };

    setNow(at('09:44:59'));
    const early = await checkIn(studentToken, inside);
    expect(early.status).toBe(409);
    expect(early.body).toMatchObject({ code: 'ATTENDANCE_CHECKIN_NOT_OPEN', details: { opens_at: '2026-11-07T09:45:00.000Z' } });

    setNow(at('11:30:00'));
    const late = await checkIn(studentToken, inside);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('ATTENDANCE_CHECKIN_CLOSED');
    expect(await t.dataSource.getRepository(AttendanceRecordEntity).count()).toBe(0);

    setNow(at('09:45:00'));
    const opened = await checkIn(studentToken, inside);
    expect(opened.status).toBe(200);
    expect(opened.body.payload.record).toMatchObject({ status: 'PRESENT', checked_in_at: '2026-11-07T09:45:00.000Z', late_minutes: null, source: 'SELF' });
  });

  it('is on time up to the start + grace and Late (with minutes since the start) after it', async () => {
    const a = await school();
    setNow(at('10:10:00'));
    const edge = await checkIn(a.studentToken, { slot_id: a.slotId, ...north(10), accuracy_m: 20 });
    expect(edge.status).toBe(200);
    expect(edge.body.payload.record).toMatchObject({ status: 'PRESENT', late_minutes: null });

    const b = await school();
    setNow(at('10:24:30'));
    const late = await checkIn(b.studentToken, { slot_id: b.slotId, ...north(10), accuracy_m: 20 });
    expect(late.status).toBe(200);
    expect(late.body.payload.record).toMatchObject({ status: 'LATE', late_minutes: 24 });
  });

  it("uses the section's own grace period over the organisation's", async () => {
    const { ownerToken, studentToken, slotId, section } = await school();
    expect((await setup(ownerToken, section.id, { grace_minutes: 0 })).status).toBe(200);
    setNow(at('10:00:01'));
    const response = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(response.body.payload).toMatchObject({ late_after: '2026-11-07T10:00:00.000Z', record: { status: 'LATE', late_minutes: 0 } });
  });

  it('accepts in-person check-ins inside the radius and refuses outside it, with poor accuracy or without a position', async () => {
    const { studentToken, slotId, student } = await school();
    setNow(at('10:05:00'));

    const far = await checkIn(studentToken, { slot_id: slotId, ...north(340), accuracy_m: 15 });
    expect(far.status).toBe(400);
    expect(far.body).toMatchObject({ code: 'ATTENDANCE_CHECKIN_TOO_FAR', details: { distance_m: 340, radius_m: 100 } });

    const vague = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 150 });
    expect(vague.status).toBe(400);
    expect(vague.body).toMatchObject({ code: 'ATTENDANCE_CHECKIN_ACCURACY_POOR', details: { accuracy_m: 150, max_accuracy_m: 100 } });

    const nowhere = await checkIn(studentToken, { slot_id: slotId });
    expect(nowhere.status).toBe(400);
    expect(nowhere.body.code).toBe('ATTENDANCE_CHECKIN_LOCATION_REQUIRED');
    expect(await t.dataSource.getRepository(AttendanceRecordEntity).countBy({ person_id: student.id })).toBe(0);

    const inside = await checkIn(studentToken, { slot_id: slotId, ...north(95), accuracy_m: 100 });
    expect(inside.status).toBe(200);
    expect(inside.body.payload.record).toMatchObject({ status: 'PRESENT', distance_m: 95, accuracy_m: 100, flag: 'EDGE_ACCURACY' });
    const saved = await t.dataSource.getRepository(AttendanceRecordEntity).findOneByOrFail({ id: inside.body.payload.record?.id });
    expect(Number(saved.geo_lat)).toBeCloseTo(north(95).latitude, 5);
  });

  it('does not flag a clear check-in near the pin', async () => {
    const { studentToken, slotId } = await school();
    setNow(at('10:05:00'));
    const response = await checkIn(studentToken, { slot_id: slotId, ...north(30), accuracy_m: 20 });
    expect(response.body.payload.record).toMatchObject({ distance_m: 30, accuracy_m: 20, flag: null });
  });

  it('flags an impossible jump from the previous in-person check-in, but still saves it', async () => {
    const { ownerToken, studentToken, section } = await school({
      slots: [
        { day_of_week: SAT, start_time: '16:00', end_time: '16:30' },
        { day_of_week: SAT, start_time: '16:35', end_time: '17:30' },
      ],
    });
    // A second branch about 111 km away.
    const other = await call<{ id: string }>('POST', '/attendance/branches', ownerToken, { name: 'Far branch', geo_lat: PIN.lat + 1, geo_lng: PIN.lng, checkin_radius_m: 100 });
    expect(other.status).toBe(201);
    const [first, second] = (await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 ORDER BY start_time`, [section.id])) as { id: string }[];
    setNow(at('10:05:00'));
    expect((await checkIn(studentToken, { slot_id: first.id, ...north(10), accuracy_m: 20 })).status).toBe(200);
    // Move the section to the far branch and check in there 35 minutes later: about 190 km/h.
    expect((await setup(ownerToken, section.id, { branch_id: other.body.payload.id })).status).toBe(200);
    setNow(at('10:40:00'));
    const jump = await checkIn(studentToken, { slot_id: second.id, latitude: PIN.lat + 1, longitude: PIN.lng, accuracy_m: 20 });
    expect(jump.status).toBe(200);
    expect(jump.body.payload.record).toMatchObject({ status: 'PRESENT', flag: 'IMPOSSIBLE_JUMP' });
  });

  it('takes online check-ins from anywhere without a position', async () => {
    const { ownerToken, studentToken, slotId, section } = await school({ pin: false });
    expect((await setup(ownerToken, section.id, { class_type: 'ONLINE' })).status).toBe(200);
    setNow(at('10:00:00'));
    expect((await today(studentToken)).body.payload.classes[0]).toMatchObject({ class_type: 'ONLINE', needs_location: false, state: 'OPEN', can_check_in: true });
    const response = await checkIn(studentToken, { slot_id: slotId });
    expect(response.status).toBe(200);
    expect(response.body.payload.record).toMatchObject({ status: 'PRESENT', distance_m: null, accuracy_m: null, flag: null });
  });

  it('needs the branch pin for in-person classes', async () => {
    const { studentToken, slotId } = await school({ pin: false });
    setNow(at('10:00:00'));
    expect((await today(studentToken)).body.payload.classes[0]).toMatchObject({ blocked: 'NO_PIN', can_check_in: false });
    const response = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ATTENDANCE_CHECKIN_NO_PIN');
  });

  it('takes one check-in per person per class', async () => {
    const { studentToken, slotId } = await school();
    setNow(at('10:00:00'));
    const first = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(first.status).toBe(200);
    setNow(at('10:20:00'));
    const again = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ code: 'ATTENDANCE_CHECKIN_ALREADY', details: { record: { status: 'PRESENT', checked_in_at: '2026-11-07T10:00:00.000Z' } } });
    expect(await t.dataSource.getRepository(ClassSessionEntity).countBy({ routine_slot_id: slotId })).toBe(1);
    expect((await today(studentToken)).body.payload.classes[0]).toMatchObject({ can_check_in: false, record: { status: 'PRESENT' } });

    // Two at once: still one record.
    const b = await school();
    setNow(at('10:01:00'));
    const both = await Promise.all([1, 2, 3].map(() => checkIn(b.studentToken, { slot_id: b.slotId, ...north(10), accuracy_m: 20 })));
    expect(both.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await t.dataSource.getRepository(AttendanceRecordEntity).countBy({ person_id: b.student.id })).toBe(1);
  });

  it('takes no check-ins on a holiday or a weekly off day', async () => {
    const holiday = await school();
    await t.dataSource.getRepository(HolidayEntity).save({
      organization_id: holiday.organization.id,
      date_from: '2026-11-07',
      date_to: '2026-11-07',
      name: 'Test holiday',
    } as DeepPartial<HolidayEntity>);
    setNow(at('10:00:00'));
    const view = (await today(holiday.studentToken)).body.payload;
    expect(view.closed).toMatchObject({ date: '2026-11-07', reason: 'HOLIDAY' });
    expect(view.classes[0]).toMatchObject({ blocked: 'CLOSED_DAY', can_check_in: false });
    const refused = await checkIn(holiday.studentToken, { slot_id: holiday.slotId, ...north(10), accuracy_m: 20 });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('ATTENDANCE_CHECKIN_CLOSED_DAY');

    const offDay = await school();
    expect((await call('PATCH', '/attendance/settings', offDay.ownerToken, { weekly_off_days: [5, SAT] })).status).toBe(200);
    const off = await checkIn(offDay.studentToken, { slot_id: offDay.slotId, ...north(10), accuracy_m: 20 });
    expect(off.status).toBe(409);
    expect(off.body).toMatchObject({ code: 'ATTENDANCE_CHECKIN_CLOSED_DAY', details: { reason: 'WEEKLY_OFF' } });
  });

  it('refuses a class that does not meet today', async () => {
    const { studentToken, slotId } = await school();
    setNow(new Date('2026-11-08T10:00:00Z'));
    const response = await checkIn(studentToken, { slot_id: slotId });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ATTENDANCE_CHECKIN_NO_CLASS_TODAY');
  });

  it('takes no self check-in for a paper-register section', async () => {
    const { ownerToken, studentToken, slotId, section } = await school();
    expect((await setup(ownerToken, section.id, { mode: 'PAPER_REGISTER' })).status).toBe(200);
    setNow(at('10:00:00'));
    expect((await today(studentToken)).body.payload.classes[0]).toMatchObject({ mode: 'PAPER_REGISTER', blocked: 'PAPER_REGISTER', can_check_in: false });
    const response = await checkIn(studentToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ATTENDANCE_CHECKIN_PAPER_REGISTER');
  });

  it('lets the teacher named on the slot, and a teacher of the section on a slot without one, check in as TEACHER', async () => {
    const { ownerToken, teacherToken, teacher, slotId, section, organization } = await school();
    setNow(at('09:58:00'));
    expect((await today(teacherToken)).body.payload.classes).toMatchObject([{ slot_id: slotId, role: 'TEACHER' }]);
    const response = await checkIn(teacherToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({ role: 'TEACHER', record: { status: 'PRESENT' } });
    expect(await t.dataSource.getRepository(AttendanceRecordEntity).findOneByOrFail({ person_id: teacher.id })).toMatchObject({ person_type: 'TEACHER' });

    // A slot without a teacher belongs to the section's teachers (here: the class teacher).
    const classTeacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, classTeacher, OrganizationMemberRoleEnum.TEACHER);
    await t.dataSource.getRepository(SectionEntity).update({ id: section.id }, { class_teacher_id: classTeacher.id });
    const classTeacherToken = orgSession(classTeacher, organization, OrganizationMemberRoleEnum.TEACHER);
    expect((await today(classTeacherToken)).body.payload.classes).toEqual([]);
    const refused = await checkIn(classTeacherToken, { slot_id: slotId, ...north(10), accuracy_m: 20 });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('ATTENDANCE_CHECKIN_NOT_YOUR_CLASS');
    expect(
      (await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, { slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30' }] })).status,
    ).toBe(200);
    const unnamed = (await today(classTeacherToken)).body.payload.classes;
    expect(unnamed).toMatchObject([{ role: 'TEACHER' }]);
    expect((await checkIn(classTeacherToken, { slot_id: unnamed[0].slot_id, ...north(10), accuracy_m: 20 })).status).toBe(200);
  });

  it("refuses other people's classes, other organisations' classes and a plan without attendance", async () => {
    const a = await school();
    const b = await school();
    setNow(at('10:00:00'));

    // A student of the same school who is not in the section.
    const outsider = await make.student();
    await make.member(a.organization, outsider, OrganizationMemberRoleEnum.STUDENT);
    const notMine = await checkIn(orgSession(outsider, a.organization, OrganizationMemberRoleEnum.STUDENT), { slot_id: a.slotId, ...north(10), accuracy_m: 20 });
    expect(notMine.status).toBe(403);
    expect(notMine.body.code).toBe('ATTENDANCE_CHECKIN_NOT_YOUR_CLASS');

    // Another organisation's slot is never found.
    const foreign = await checkIn(b.studentToken, { slot_id: a.slotId, ...north(10), accuracy_m: 20 });
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe('ATTENDANCE_CHECKIN_CLASS_NOT_FOUND');
    expect((await today(b.studentToken)).body.payload.classes.map((c) => c.slot_id)).toEqual([b.slotId]);

    // A school without attendance in its plan.
    const off = await school({ enabled: false });
    const gated = await today(off.studentToken);
    expect(gated.status).toBe(403);
    expect(gated.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN' });
    expect((await checkIn(off.studentToken, { slot_id: a.slotId })).status).toBe(403);
    expect(await t.dataSource.getRepository(AttendanceRecordEntity).count({ where: { organization_id: b.organization.id } })).toBe(0);
  });

  it("lets a student of a solo teacher's online class check in through their enrolment", async () => {
    const teacher = await make.teacher();
    const solo = await make.soloOrganization(teacher);
    await enableAttendance(solo);
    const teacherToken = t.tokenFor(teacher);
    const created = await call<{ id: string }>('POST', '/classes', teacherToken, { class_name: 'IELTS batch' });
    expect(created.status).toBe(201);
    const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: created.body.payload.id });
    expect((await setup(teacherToken, section.id, { class_type: 'ONLINE' })).status).toBe(200);
    expect(
      (await call('PUT', `/attendance/setup/sections/${section.id}/slots`, teacherToken, { slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30' }] })).status,
    ).toBe(200);
    const student = await make.student();
    await make.enrol({ id: created.body.payload.id }, student);
    const studentToken = t.tokenFor(student, { context_type: 'individual_teacher', teacher_id: teacher.id });

    setNow(at('10:00:00'));
    const view = (await today(studentToken)).body.payload;
    expect(view.classes).toMatchObject([{ role: 'STUDENT', class_type: 'ONLINE', can_check_in: true }]);
    expect((await checkIn(studentToken, { slot_id: view.classes[0].slot_id })).status).toBe(200);
    // The solo teacher has no check-in of their own.
    expect((await today(teacherToken)).body.payload.classes).toEqual([]);
    expect(solo.kind).toBe(OrganizationKindEnum.SOLO);
  });
});
