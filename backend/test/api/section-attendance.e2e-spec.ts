import { DeepPartial } from 'typeorm';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceCorrectionEntity } from '../../src/attendance/entities/attendance-correction.entity';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Correction = { old_status: string | null; new_status: string; reason: string; corrected_by: { id: string } | null };
type Row = {
  person: { id: string; full_name: string; roll_no: string | null };
  role: string;
  status: string;
  record: { status: string; late_minutes: number | null; flag: string | null; source: string } | null;
  corrections: Correction[];
  can_correct: boolean;
};
type Summary = {
  slot_id: string;
  date: string;
  section: { name: string; class_name: string };
  state: string;
  closed: { reason: string } | null;
  teacher: { id: string } | null;
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; flagged: number };
  can_correct: boolean;
};
type Detail = Summary & { students: Row[]; teachers: Row[] };
type Body<T> = { payload: T; code?: string; message?: unknown };

const SAT = 6;
const DATE = '2026-11-07';
const PIN = { lat: 23.758, lng: 90.389 };
const near = { latitude: PIN.lat + 0.0001, longitude: PIN.lng, accuracy_m: 15 };

/**
 * The teacher's class view and corrections (P3-03; ATT-07, ATT-12, ATT-11): the classes of a date,
 * one class's list with computed statuses, corrections with a reason and their trail and audit,
 * who may see and correct what, when a correction is possible, tenancy and the plan gate.
 */
describe('section attendance API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const list = (token: string, date = DATE) => call<{ date: string; sessions: Summary[]; closed: unknown }>('GET', `/attendance/sessions?date=${date}`, token);
  const detail = (token: string, slotId: string, date = DATE) => call<Detail>('GET', `/attendance/sessions/${slotId}/${date}`, token);
  const correct = (token: string, slotId: string, personId: string, body: unknown, date = DATE) =>
    call<Detail>('PUT', `/attendance/sessions/${slotId}/${date}/records/${personId}`, token, body);
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const rowOf = (view: Detail, id: string) => view.students.find((row) => row.person.id === id) as Row;

  const enable = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-03 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school: Class 8 A meets Saturdays 16:00–17:30 with a named teacher and two students (Rahim,
   * roll 1; Karim, roll 2); Class 9 A meets at the same time with no teacher named.
   */
  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) await enable(organization);
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
    const student = async (name: string, roll: string) => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      const enrolment = await make.enrol(c8.classEntity, user);
      await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z', roll_no = $2 WHERE id = $1`, [enrolment.id, roll]);
      return { user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) };
    };
    const rahim = await student('Rahim', '1');
    const karim = await student('Karim', '2');
    if (enabled) {
      const branches = await call<{ id: string; is_default: boolean }[]>('GET', '/attendance/branches', ownerToken);
      const main = branches.body.payload.find((b) => b.is_default) as { id: string };
      await call('PATCH', `/attendance/branches/${main.id}`, ownerToken, { geo_lat: PIN.lat, geo_lng: PIN.lng, checkin_radius_m: 100 });
      for (const [section, teacherId] of [[c8.section, teacher.id], [c9.section, null]] as const) {
        const saved = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, {
          slots: [{ day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: teacherId }],
        });
        expect(saved.status).toBe(200);
      }
    }
    const slotOf = async (sectionId: string) =>
      ((await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1 AND is_active = '1'`, [sectionId])) as { id: string }[])[0]?.id;
    return {
      owner,
      organization,
      ownerToken,
      teacher,
      teacherToken: orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER),
      rahim,
      karim,
      c8,
      c9,
      slot8: enabled ? await slotOf(c8.section.id) : '',
      slot9: enabled ? await slotOf(c9.section.id) : '',
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
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

  it('lists the classes of a date with counts: owners see every class, a teacher only theirs', async () => {
    const s = await school();
    setNow(`${DATE}T10:20:00Z`);
    expect((await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, ...near })).status).toBe(200);
    setNow(`${DATE}T12:00:00Z`);

    const owner = await list(s.ownerToken);
    expect(owner.status).toBe(200);
    expect(owner.body.payload.sessions.map((x) => `${x.section.class_name} ${x.section.name}`)).toEqual(['Class 8 A', 'Class 9 A']);
    expect(owner.body.payload.sessions[0]).toMatchObject({
      slot_id: s.slot8,
      state: 'CLOSED',
      teacher: { id: s.teacher.id },
      counts: { students: 2, present: 0, late: 1, absent: 1, leave: 0, waiting: 0, flagged: 0 },
      can_correct: true,
    });

    const teacher = await list(s.teacherToken);
    expect(teacher.body.payload.sessions.map((x) => x.slot_id)).toEqual([s.slot8]);

    const student = await list(s.rahim.token);
    expect(student.status).toBe(403);

    // A date with no class, and a bad date.
    expect((await list(s.ownerToken, '2026-11-08')).body.payload.sessions).toEqual([]);
    expect((await list(s.ownerToken, '2026-02-30')).body.code).toBe('ATTENDANCE_SESSION_DATE_INVALID');
  });

  it("shows a class's list: who checked in, Late with minutes and flags, Absent once check-in closes, the teacher", async () => {
    const s = await school();
    setNow(`${DATE}T10:20:00Z`);
    await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, latitude: PIN.lat + 0.0008, longitude: PIN.lng, accuracy_m: 60 });
    await call('POST', '/attendance/check-in', s.teacherToken, { slot_id: s.slot8, ...near });

    let view = (await detail(s.teacherToken, s.slot8)).body.payload;
    expect(view.state).toBe('OPEN');
    expect(view.students.map((row) => `${row.person.roll_no} ${row.person.full_name} ${row.status}`)).toEqual(['1 Rahim LATE', '2 Karim OPEN']);
    expect(rowOf(view, s.rahim.user.id).record).toMatchObject({ status: 'LATE', late_minutes: 20, flag: 'EDGE_ACCURACY', source: 'SELF' });
    expect(view.counts.flagged).toBe(1);
    expect(view.teachers).toMatchObject([{ person: { id: s.teacher.id, full_name: 'Rina Akter' }, role: 'TEACHER', status: 'LATE', can_correct: false }]);

    setNow(`${DATE}T11:30:00Z`);
    view = (await detail(s.teacherToken, s.slot8)).body.payload;
    expect(rowOf(view, s.karim.user.id)).toMatchObject({ status: 'ABSENT', record: null, can_correct: true });

    // Before the class: everyone is upcoming and nothing can be corrected.
    setNow(`${DATE}T09:00:00Z`);
    const before = (await detail(s.ownerToken, s.slot9)).body.payload;
    expect(before).toMatchObject({ state: 'UPCOMING', can_correct: false, students: [], teachers: [] });
  });

  it('corrects Absent to Present with a reason, keeps the trail and writes the audit log', async () => {
    const s = await school();
    setNow(`${DATE}T12:00:00Z`);
    const response = await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'PRESENT', reason: 'His phone had no internet; he was in class' });
    expect(response.status).toBe(200);
    const row = rowOf(response.body.payload, s.karim.user.id);
    expect(row).toMatchObject({
      status: 'PRESENT',
      record: { status: 'PRESENT', source: 'CORRECTION' },
      corrections: [{ old_status: null, new_status: 'PRESENT', reason: 'His phone had no internet; he was in class', corrected_by: { id: s.teacher.id } }],
    });

    // A second correction adds to the trail.
    const again = await correct(s.ownerToken, s.slot8, s.karim.user.id, { status: 'LATE', late_minutes: 12, reason: 'Came after the bell' });
    expect(rowOf(again.body.payload, s.karim.user.id)).toMatchObject({ status: 'LATE', record: { late_minutes: 12 } });
    expect(rowOf(again.body.payload, s.karim.user.id).corrections.map((c) => `${c.old_status}→${c.new_status}`)).toEqual(['null→PRESENT', 'PRESENT→LATE']);
    const saved = await t.dataSource.getRepository(AttendanceCorrectionEntity).find({ where: { organization_id: s.organization.id } });
    expect(saved).toHaveLength(2);
    expect(saved.every((c) => c.correction_sms_sent === false)).toBe(true);

    await audit.flush();
    const logs = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'attendance.correct' }, order: { id: 'ASC' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ actor_id: s.teacher.id, entity_type: 'attendance_record', reason: 'His phone had no internet; he was in class' });
    expect(logs[1].after).toMatchObject({ status: 'LATE', late_minutes: 12, person_id: s.karim.user.id, date: DATE, slot_id: s.slot8 });

    // The student sees the corrected status on their own calendar.
    const mine = await call<{ days: { date: string; classes: { status: string }[] }[] }>('GET', '/attendance/me/calendar?month=2026-11', s.karim.token);
    expect(mine.body.payload.days.find((d) => d.date === DATE)?.classes[0].status).toBe('LATE');
  });

  it('corrects a self check-in, keeping its check-in time', async () => {
    const s = await school();
    setNow(`${DATE}T10:30:00Z`);
    await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.slot8, ...near });
    const response = await correct(s.teacherToken, s.slot8, s.rahim.user.id, { status: 'PRESENT', reason: 'Was at the gate on time' });
    expect(response.status).toBe(200);
    expect(rowOf(response.body.payload, s.rahim.user.id).corrections[0]).toMatchObject({ old_status: 'LATE', new_status: 'PRESENT' });
    const record = await t.dataSource.getRepository(AttendanceRecordEntity).findOneByOrFail({ person_id: s.rahim.user.id });
    expect(record).toMatchObject({ status: 'PRESENT', late_minutes: null, source: 'CORRECTION', distance_m: 11 });
    expect(record.checked_in_at?.toISOString()).toBe(`${DATE}T10:30:00.000Z`);
  });

  it('refuses a correction before the class starts, on a holiday, without a reason, to Leave, or with no change', async () => {
    const s = await school();
    setNow(`${DATE}T09:50:00Z`);
    const early = await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'PRESENT', reason: 'Early' });
    expect(early.status).toBe(409);
    expect(early.body.code).toBe('ATTENDANCE_CORRECTION_NOT_STARTED');

    setNow(`${DATE}T12:00:00Z`);
    expect((await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'PRESENT', reason: '' })).status).toBe(400);
    expect((await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'LEAVE', reason: 'Sick' })).status).toBe(400);
    const same = await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'ABSENT', reason: 'Really absent' });
    expect(same.status).toBe(200);
    const noChange = await correct(s.teacherToken, s.slot8, s.karim.user.id, { status: 'ABSENT', reason: 'Again' });
    expect(noChange.status).toBe(400);
    expect(noChange.body.code).toBe('ATTENDANCE_CORRECTION_NO_CHANGE');

    await t.dataSource.getRepository(HolidayEntity).save({ organization_id: s.organization.id, date_from: DATE, date_to: DATE, name: 'Closed' } as DeepPartial<HolidayEntity>);
    const holiday = await correct(s.teacherToken, s.slot8, s.rahim.user.id, { status: 'PRESENT', reason: 'Holiday' });
    expect(holiday.status).toBe(409);
    expect(holiday.body.code).toBe('ATTENDANCE_CORRECTION_CLOSED_DAY');
    expect((await detail(s.teacherToken, s.slot8)).body.payload).toMatchObject({ closed: { reason: 'HOLIDAY' }, can_correct: false });
  });

  it("lets only owners, admins and assistants correct a teacher's record", async () => {
    const s = await school();
    setNow(`${DATE}T12:00:00Z`);
    const own = await correct(s.teacherToken, s.slot8, s.teacher.id, { status: 'PRESENT', reason: 'I was there' });
    expect(own.status).toBe(403);
    expect(own.body.code).toBe('ATTENDANCE_CORRECTION_TEACHER_RECORD');
    const byOwner = await correct(s.ownerToken, s.slot8, s.teacher.id, { status: 'PRESENT', reason: 'Seen in class' });
    expect(byOwner.status).toBe(200);
    expect(byOwner.body.payload.teachers).toMatchObject([{ person: { id: s.teacher.id }, status: 'PRESENT', can_correct: true }]);
  });

  it("refuses people outside the class, other teachers' classes, other organisations and a plan without attendance", async () => {
    const s = await school();
    const other = await school();
    setNow(`${DATE}T12:00:00Z`);

    const stranger = await correct(s.ownerToken, s.slot8, other.rahim.user.id, { status: 'PRESENT', reason: 'Not ours' });
    expect(stranger.status).toBe(404);
    expect(stranger.body.code).toBe('ATTENDANCE_CORRECTION_PERSON_NOT_FOUND');

    // The teacher does not teach Class 9.
    expect((await detail(s.teacherToken, s.slot9)).status).toBe(404);
    expect((await correct(s.teacherToken, s.slot9, s.rahim.user.id, { status: 'PRESENT', reason: 'Not mine' })).status).toBe(404);

    // Another organisation's class is never found.
    const foreign = await detail(other.ownerToken, s.slot8);
    expect(foreign.status).toBe(404);
    expect((await correct(other.ownerToken, s.slot8, s.rahim.user.id, { status: 'PRESENT', reason: 'Foreign' })).status).toBe(404);
    expect((await list(other.ownerToken)).body.payload.sessions.map((x) => x.slot_id).sort()).toEqual([other.slot8, other.slot9].sort());

    // Students see no class lists.
    expect((await detail(s.rahim.token, s.slot8)).status).toBe(403);

    // A student who joined after the date is not on that date's list.
    await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-11-10T00:00:00Z' WHERE student_id = $1`, [s.karim.user.id]);
    expect((await detail(s.ownerToken, s.slot8)).body.payload.students.map((row) => row.person.full_name)).toEqual(['Rahim']);

    const off = await school({ enabled: false });
    const gated = await list(off.ownerToken);
    expect(gated.status).toBe(403);
    expect(gated.body.code).toBe('FEATURE_NOT_IN_PLAN');
  });
});
