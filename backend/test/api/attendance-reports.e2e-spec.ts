import { DeepPartial } from 'typeorm';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceReportsService } from '../../src/attendance/attendance-reports.service';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { LeaveRequestEntity, LeaveStatusEnum } from '../../src/attendance/entities/leave-request.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: unknown };
type Counts = { present: number; late: number; absent: number; leave: number };
type DayMark = { status: string; missed: number; waiting: number } | null;
type Daily = {
  date: string;
  closed: { reason: string } | null;
  sections: {
    section: { id: string; name: string; class_name: string };
    mode: string;
    classes: { slot_id: string; start_time: string; teacher: { id: string } | null; cancelled: boolean; counts: Record<string, number> }[];
    counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; missed_some: number };
    students: { id: string; full_name: string; marks: (string | null)[]; day: DayMark }[];
  }[];
};
type Monthly = {
  month: string;
  classes: { header: string; date: string }[];
  days: { date: string; classes: number }[];
  students: { id: string; full_name: string; marks: (string | null)[]; days: DayMark[]; counts: Counts; attendance_pct: number | null }[];
  counts: Counts;
  attendance_pct: number | null;
};
type Teachers = {
  from: string;
  to: string;
  teachers: { teacher: { id: string; full_name: string }; counts: Counts; attendance_pct: number | null; late_minutes: number; classes: { date: string; status: string; start_time: string; late_minutes: number | null; section: { class_name: string } }[] }[];
};
type Calendar = { counts: Counts; attendance_pct: number | null };

const MON = 1;
const SAT = 6;
const MONTH = '2026-11';
/** Sunday 15 Nov 2026, 12:00 in Dhaka. */
const NOW = '2026-11-15T06:00:00Z';
/** An instant of a wall-clock time on a date in Dhaka (UTC+6). */
const dhaka = (date: string, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return new Date(Date.parse(`${date}T00:00:00Z`) + ((h - 6) * 60 + m) * 60_000);
};

/**
 * Attendance reports (P3-07, ATT-13, ATT-11): the daily summary per section, the monthly register
 * with counts and %, the teacher report, and the attendance % for Performance. Counts match the
 * class records with cancelled classes, holidays, leave and paper-register sections; the % matches
 * "My attendance"; who sees what; tenancy; and the time on a realistic month (40 students × 6
 * classes a day × 26 days).
 */
describe('attendance reports API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let reports: AttendanceReportsService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const daily = (token: string, query = '') => call<Daily>('GET', `/attendance/reports/daily${query}`, token);
  const monthly = (token: string, sectionId: string, month = MONTH) => call<Monthly>('GET', `/attendance/reports/sections/${sectionId}/month?month=${month}`, token);
  const teachers = (token: string, query = '') => call<Teachers>('GET', `/attendance/reports/teachers${query}`, token);

  const feature = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-07 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /** A school with the attendance feature, its owner and a way to add classes (each with one section). */
  const organizationWithOwner = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await feature(organization);
    const ownerToken = orgSession(owner, organization, OrganizationMemberRoleEnum.OWNER);
    const newSection = async (name: string) => {
      const created = await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: name });
      const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: created.body.payload.id });
      const section = await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ class_id: classEntity.id });
      return { classEntity, section };
    };
    const setSlots = async (sectionId: string, slots: { day_of_week: number; start_time: string; end_time: string; teacher_id: string | null }[]) => {
      expect((await call('PUT', `/attendance/setup/sections/${sectionId}/slots`, ownerToken, { slots })).status).toBe(200);
      await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id = $1`, [sectionId]);
    };
    const student = async (name: string, classes: ClassEntity[], roll: string) => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      for (const classEntity of classes) {
        const enrolment = await make.enrol(classEntity, user);
        await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z', roll_no = $2 WHERE id = $1`, [enrolment.id, roll]);
      }
      return user;
    };
    return { owner, organization, ownerToken, newSection, setSlots, student };
  };

  /** A saved session (optionally cancelled) and a record in it, as check-in, the closing job or leave would leave them. */
  const saveRecord = async (
    organizationId: string,
    sectionId: string,
    slotId: string,
    date: string,
    time: [string, string],
    personId: string,
    values: Partial<AttendanceRecordEntity>,
    sessionStatus = 'SCHEDULED',
  ) => {
    await t.dataSource.query(
      `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [organizationId, sectionId, slotId, date, dhaka(date, time[0]), dhaka(date, time[1]), sessionStatus],
    );
    const [session] = (await t.dataSource.query(`SELECT id FROM class_attendance WHERE routine_slot_id = $1 AND date = $2`, [slotId, date])) as { id: string }[];
    await t.dataSource.getRepository(AttendanceRecordEntity).save({
      organization_id: organizationId,
      class_attendance_id: session.id,
      date,
      person_id: personId,
      person_type: 'STUDENT',
      source: 'SELF',
      ...values,
    } as DeepPartial<AttendanceRecordEntity>);
  };

  /**
   * Class 8 A (self check-in, online): Saturdays 09:00 (teacher Rina) and 10:00, Mondays 09:00.
   * Class 9 A (paper register): Saturdays 12:00. Rahim (roll 1) is in both; Karim (2) and Salma (3)
   * in 8 A. Monday 9 Nov is a holiday; Saturday 7 Nov's 10:00 class was cancelled after Rahim had
   * checked in; Salma is on approved leave on Saturday 14 Nov. Records:
   *   Mon 2 Nov 09:00   Rahim P, Karim P, Salma A
   *   Sat 7 Nov 09:00   Rahim P, Karim A, Salma P; Rina (teacher) A
   *   Sat 7 Nov 10:00   cancelled (Rahim P, not counted)
   *   Sat 14 Nov 09:00  Rahim P, Karim L, Salma Leave; Rina L (5 min)
   *   Sat 14 Nov 10:00  Rahim A, Karim L, Salma Leave
   *   Sat 9 A 12:00     no register yet
   */
  const school = async () => {
    setNow(NOW);
    const base = await organizationWithOwner();
    const { organization, ownerToken } = base;
    const c8 = await base.newSection('Class 8');
    const c9 = await base.newSection('Class 9');
    const rina = await make.teacher({ personal_teacher_enabled: false, full_name: 'Rina Akter' });
    await make.member(organization, rina, OrganizationMemberRoleEnum.TEACHER);
    const other = await make.teacher({ personal_teacher_enabled: false, full_name: 'Other Teacher' });
    await make.member(organization, other, OrganizationMemberRoleEnum.TEACHER);
    const staff = await make.teacher({ personal_teacher_enabled: false, full_name: 'Office Staff' });
    await make.member(organization, staff, OrganizationMemberRoleEnum.ASSISTANT);
    const manager = await make.teacher({ personal_teacher_enabled: false, full_name: 'School Admin' });
    await make.member(organization, manager, OrganizationMemberRoleEnum.ADMIN);
    const rahim = await base.student('Rahim', [c8.classEntity, c9.classEntity], '1');
    const karim = await base.student('Karim', [c8.classEntity], '2');
    const salma = await base.student('Salma', [c8.classEntity], '3');

    await base.setSlots(c8.section.id, [
      { day_of_week: SAT, start_time: '09:00', end_time: '10:00', teacher_id: rina.id },
      { day_of_week: SAT, start_time: '10:00', end_time: '11:00', teacher_id: null },
      { day_of_week: MON, start_time: '09:00', end_time: '10:00', teacher_id: null },
    ]);
    await base.setSlots(c9.section.id, [{ day_of_week: SAT, start_time: '12:00', end_time: '13:00', teacher_id: null }]);
    expect((await call('PATCH', `/attendance/setup/sections/${c8.section.id}`, ownerToken, { class_type: 'ONLINE' })).status).toBe(200);
    expect((await call('PATCH', `/attendance/setup/sections/${c9.section.id}`, ownerToken, { mode: 'PAPER_REGISTER', class_type: 'ONLINE' })).status).toBe(200);
    await t.dataSource.getRepository(HolidayEntity).save({ organization_id: organization.id, date_from: '2026-11-09', date_to: '2026-11-09', name: 'Closed' } as DeepPartial<HolidayEntity>);
    const leave = await t.dataSource.getRepository(LeaveRequestEntity).save({
      organization_id: organization.id,
      person_id: salma.id,
      person_type: 'STUDENT',
      from_date: '2026-11-14',
      to_date: '2026-11-14',
      reason: 'Family event',
      status: LeaveStatusEnum.APPROVED,
      decided_at: new Date('2026-11-10T00:00:00Z'),
    } as DeepPartial<LeaveRequestEntity>);

    const slots = (await t.dataSource.query(`SELECT id, section_id, day_of_week, start_time FROM routine_slots WHERE section_id IN ($1, $2) AND is_active = '1'`, [
      c8.section.id,
      c9.section.id,
    ])) as { id: string; section_id: string; day_of_week: number; start_time: string }[];
    const slot = (sectionId: string, day: number, start: string) => (slots.find((s) => s.section_id === sectionId && s.day_of_week === day && s.start_time.startsWith(start)) as { id: string }).id;
    const sat9 = slot(c8.section.id, SAT, '09:00');
    const sat10 = slot(c8.section.id, SAT, '10:00');
    const mon9 = slot(c8.section.id, MON, '09:00');
    const at = (slotId: string, date: string, time: [string, string], personId: string, values: Partial<AttendanceRecordEntity>, status?: string) =>
      saveRecord(organization.id, c8.section.id, slotId, date, time, personId, values, status);
    const P = { status: 'PRESENT' } as Partial<AttendanceRecordEntity>;
    const A = { status: 'ABSENT', source: 'AUTO_ABSENT' } as Partial<AttendanceRecordEntity>;
    const L = { status: 'LATE', late_minutes: 12 } as Partial<AttendanceRecordEntity>;
    const LV = { status: 'LEAVE', source: 'AUTO_ABSENT', leave_request_id: leave.id } as Partial<AttendanceRecordEntity>;
    const T = (values: Partial<AttendanceRecordEntity>) => ({ ...values, person_type: 'TEACHER' }) as Partial<AttendanceRecordEntity>;

    await at(mon9, '2026-11-02', ['09:00', '10:00'], rahim.id, P);
    await at(mon9, '2026-11-02', ['09:00', '10:00'], karim.id, P);
    await at(mon9, '2026-11-02', ['09:00', '10:00'], salma.id, A);
    await at(sat9, '2026-11-07', ['09:00', '10:00'], rahim.id, P);
    await at(sat9, '2026-11-07', ['09:00', '10:00'], karim.id, A);
    await at(sat9, '2026-11-07', ['09:00', '10:00'], salma.id, P);
    await at(sat9, '2026-11-07', ['09:00', '10:00'], rina.id, T(A));
    await at(sat10, '2026-11-07', ['10:00', '11:00'], rahim.id, P, 'CANCELLED');
    await at(sat10, '2026-11-07', ['10:00', '11:00'], rina.id, T({ status: 'LATE', late_minutes: 30 } as Partial<AttendanceRecordEntity>));
    await at(sat9, '2026-11-14', ['09:00', '10:00'], rahim.id, P);
    await at(sat9, '2026-11-14', ['09:00', '10:00'], karim.id, L);
    await at(sat9, '2026-11-14', ['09:00', '10:00'], salma.id, LV);
    await at(sat9, '2026-11-14', ['09:00', '10:00'], rina.id, T({ status: 'LATE', late_minutes: 5 } as Partial<AttendanceRecordEntity>));
    await at(sat10, '2026-11-14', ['10:00', '11:00'], rahim.id, A);
    await at(sat10, '2026-11-14', ['10:00', '11:00'], karim.id, L);
    await at(sat10, '2026-11-14', ['10:00', '11:00'], salma.id, LV);

    return {
      ...base,
      c8,
      c9,
      rina,
      rahim,
      karim,
      salma,
      sat9,
      rinaToken: orgSession(rina, organization, OrganizationMemberRoleEnum.TEACHER),
      otherToken: orgSession(other, organization, OrganizationMemberRoleEnum.TEACHER),
      staffToken: orgSession(staff, organization, OrganizationMemberRoleEnum.ASSISTANT),
      adminToken: orgSession(manager, organization, OrganizationMemberRoleEnum.ADMIN),
      studentToken: (user: UserEntity) => orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT),
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    reports = t.app.get(AttendanceReportsService);
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

  describe('daily summary per section', () => {
    it('lists each section with its classes and every student as present, late, absent or on leave, with counts', async () => {
      const s = await school();
      const response = await daily(s.ownerToken, '?date=2026-11-14');
      expect(response.status).toBe(200);
      const report = response.body.payload;
      expect(report).toMatchObject({ date: '2026-11-14', closed: null });
      expect(report.sections.map((section) => [section.section.class_name, section.mode])).toEqual([
        ['Class 8', 'SELF_CHECKIN'],
        ['Class 9', 'PAPER_REGISTER'],
      ]);
      const [c8, c9] = report.sections;
      expect(c8.classes.map((c) => [c.start_time, c.teacher?.id ?? null, c.cancelled])).toEqual([
        ['09:00', s.rina.id, false],
        ['10:00', null, false],
      ]);
      expect(c8.students.map((st) => [st.full_name, st.marks, st.day])).toEqual([
        ['Rahim', ['PRESENT', 'ABSENT'], { status: 'PRESENT', missed: 1, waiting: 0 }],
        ['Karim', ['LATE', 'LATE'], { status: 'LATE', missed: 0, waiting: 0 }],
        ['Salma', ['LEAVE', 'LEAVE'], { status: 'LEAVE', missed: 0, waiting: 0 }],
      ]);
      expect(c8.counts).toEqual({ students: 3, present: 1, late: 1, absent: 0, leave: 1, waiting: 0, missed_some: 1 });
      // The per-class counts are the class view's.
      expect(c8.classes[1].counts).toMatchObject({ students: 3, present: 0, late: 1, absent: 1, leave: 1 });
      // The paper register is not in yet: Rahim waits, nobody is Absent.
      expect(c9.students.map((st) => [st.full_name, st.marks, st.day?.status])).toEqual([['Rahim', ['NOT_RECORDED'], 'WAITING']]);
      expect(c9.counts).toMatchObject({ students: 1, waiting: 1, absent: 0 });

      // One section only.
      const one = await daily(s.ownerToken, `?date=2026-11-14&section_id=${s.c9.section.id}`);
      expect(one.body.payload.sections.map((section) => section.section.id)).toEqual([s.c9.section.id]);
    });

    it('counts a student absent from every class as Absent, and leaves cancelled classes out', async () => {
      const s = await school();
      const report = (await daily(s.ownerToken, '?date=2026-11-07')).body.payload;
      const c8 = report.sections.find((section) => section.section.id === s.c8.section.id);
      expect(c8?.classes.map((c) => [c.start_time, c.cancelled])).toEqual([
        ['09:00', false],
        ['10:00', true],
      ]);
      expect(c8?.students.map((st) => [st.full_name, st.marks, st.day?.status])).toEqual([
        ['Rahim', ['PRESENT', 'CANCELLED'], 'PRESENT'],
        ['Karim', ['ABSENT', 'CANCELLED'], 'ABSENT'],
        ['Salma', ['PRESENT', 'CANCELLED'], 'PRESENT'],
      ]);
      expect(c8?.counts).toMatchObject({ present: 2, absent: 1, missed_some: 0 });
    });

    it('shows a holiday as closed with nobody absent, and refuses a date that is not real', async () => {
      const s = await school();
      const report = (await daily(s.ownerToken, '?date=2026-11-09')).body.payload;
      expect(report.closed).toMatchObject({ reason: 'HOLIDAY' });
      for (const section of report.sections) {
        expect(section.counts).toMatchObject({ present: 0, late: 0, absent: 0, leave: 0 });
      }
      expect((await daily(s.ownerToken, '?date=2026-11-31')).body.code).toBe('ATTENDANCE_REPORT_DATE_INVALID');
      expect((await daily(s.ownerToken, '?date=14-11-2026')).status).toBe(400);
    });
  });

  describe('monthly register with counts and attendance %', () => {
    it("matches the class records: cancelled classes and holidays left out, leave not held against anyone", async () => {
      const s = await school();
      const response = await monthly(s.ownerToken, s.c8.section.id);
      expect(response.status).toBe(200);
      const report = response.body.payload;
      // The grid is the register CSV's (P3-05): one column per class, the date plus the time on days with two.
      expect(report.classes.slice(0, 4).map((c) => c.header)).toEqual(['2026-11-02', '2026-11-07', '2026-11-14 09:00', '2026-11-14 10:00']);
      expect(report.days.slice(0, 3)).toEqual([
        { date: '2026-11-02', classes: 1 },
        { date: '2026-11-07', classes: 1 },
        { date: '2026-11-14', classes: 2 },
      ]);
      expect(report.days.some((day) => day.date === '2026-11-09')).toBe(false);
      const byName = new Map(report.students.map((st) => [st.full_name, st]));
      expect(byName.get('Rahim')).toMatchObject({ counts: { present: 3, late: 0, absent: 1, leave: 0 }, attendance_pct: 75 });
      expect(byName.get('Karim')).toMatchObject({ counts: { present: 1, late: 2, absent: 1, leave: 0 }, attendance_pct: 75 });
      expect(byName.get('Salma')).toMatchObject({ counts: { present: 1, late: 0, absent: 1, leave: 2 }, attendance_pct: 50 });
      expect(byName.get('Rahim')?.days.slice(0, 4)).toEqual([
        { status: 'PRESENT', missed: 0, waiting: 0 },
        { status: 'PRESENT', missed: 0, waiting: 0 },
        { status: 'PRESENT', missed: 1, waiting: 0 },
        null, // Monday 16 Nov is still to come
      ]);
      expect(report).toMatchObject({ counts: { present: 5, late: 2, absent: 3, leave: 2 }, attendance_pct: 70 });
    });

    it('shows a paper register not in yet as empty, never Absent', async () => {
      const s = await school();
      const report = (await monthly(s.ownerToken, s.c9.section.id)).body.payload;
      expect(report.students.map((st) => [st.full_name, st.counts, st.attendance_pct, st.days[0]])).toEqual([
        ['Rahim', { present: 0, late: 0, absent: 0, leave: 0 }, null, null],
      ]);
    });

    it("gives each student the same % as their own \"My attendance\" and as the Performance read", async () => {
      const s = await school();
      const report = (await monthly(s.ownerToken, s.c8.section.id)).body.payload;
      const performance = await reports.studentAttendance(s.organization.id, [s.rahim.id, s.karim.id, s.salma.id], '2026-11-01', '2026-11-30');
      for (const student of [s.rahim, s.karim, s.salma]) {
        const calendar = (await call<Calendar>('GET', `/attendance/me/calendar?month=${MONTH}`, s.studentToken(student))).body.payload;
        const row = report.students.find((st) => st.id === student.id);
        expect([student.full_name, row?.counts, row?.attendance_pct]).toEqual([student.full_name, calendar.counts, calendar.attendance_pct]);
        expect(performance.get(student.id)).toEqual({ counts: calendar.counts, attendance_pct: calendar.attendance_pct });
      }
    });
  });

  describe('attendance % for Performance (studentAttendance)', () => {
    it('counts records in the period only, leaves cancelled classes out, and gives zero counts without records', async () => {
      const s = await school();
      const nobody = await s.student('Nobody', [], '9');
      const result = await reports.studentAttendance(s.organization.id, [s.rahim.id, nobody.id], '2026-11-07', '2026-11-07');
      expect(result.get(s.rahim.id)).toEqual({ counts: { present: 1, late: 0, absent: 0, leave: 0 }, attendance_pct: 100 });
      expect(result.get(nobody.id)).toEqual({ counts: { present: 0, late: 0, absent: 0, leave: 0 }, attendance_pct: null });
      // Another organisation's id never reads these records.
      const elsewhere = await organizationWithOwner();
      const other = await reports.studentAttendance(elsewhere.organization.id, [s.rahim.id], '2026-11-01', '2026-11-30');
      expect(other.get(s.rahim.id)?.attendance_pct).toBeNull();
    });
  });

  describe('teacher report (owners and admins)', () => {
    it("lists teachers' classes with counts, %, minutes late and the classes not on time", async () => {
      const s = await school();
      const response = await teachers(s.ownerToken, '?from=2026-11-01&to=2026-11-15');
      expect(response.status).toBe(200);
      expect(response.body.payload.teachers).toEqual([
        {
          teacher: { id: s.rina.id, full_name: 'Rina Akter' },
          counts: { present: 0, late: 1, absent: 1, leave: 0 },
          attendance_pct: 50,
          late_minutes: 5,
          classes: [
            expect.objectContaining({ date: '2026-11-07', status: 'ABSENT', start_time: '09:00', late_minutes: null, section: expect.objectContaining({ class_name: 'Class 8' }) }),
            expect.objectContaining({ date: '2026-11-14', status: 'LATE', start_time: '09:00', late_minutes: 5 }),
          ],
        },
      ]);
      // The daily summary of late and absent teachers is the same report for one day (default today).
      const day = (await teachers(s.adminToken, '?from=2026-11-14')).body.payload;
      expect(day).toMatchObject({ from: '2026-11-14', to: '2026-11-14' });
      expect(day.teachers.map((row) => [row.teacher.full_name, row.classes.map((c) => c.status)])).toEqual([['Rina Akter', ['LATE']]]);
      expect((await teachers(s.ownerToken)).body.payload).toMatchObject({ from: '2026-11-15', to: '2026-11-15', teachers: [] });
    });

    it('refuses a range that ends before it starts or is longer than 31 days', async () => {
      const s = await school();
      expect((await teachers(s.ownerToken, '?from=2026-11-10&to=2026-11-01')).body.code).toBe('ATTENDANCE_REPORT_RANGE_INVALID');
      const long = await teachers(s.ownerToken, '?from=2026-10-01&to=2026-11-01');
      expect([long.status, long.body.code]).toEqual([400, 'ATTENDANCE_REPORT_RANGE_TOO_LONG']);
      expect((await teachers(s.ownerToken, '?from=2026-10-02&to=2026-11-01')).status).toBe(200);
    });
  });

  describe('who sees what', () => {
    it('a teacher sees their own sections only and never the teacher report', async () => {
      const s = await school();
      const mine = (await daily(s.rinaToken, '?date=2026-11-14')).body.payload;
      expect(mine.sections.map((section) => section.section.id)).toEqual([s.c8.section.id]);
      expect((await monthly(s.rinaToken, s.c8.section.id)).status).toBe(200);
      const notMine = await monthly(s.rinaToken, s.c9.section.id);
      expect([notMine.status, notMine.body.code]).toEqual([404, 'ATTENDANCE_REGISTER_SECTION_NOT_FOUND']);
      const filtered = await daily(s.rinaToken, `?date=2026-11-14&section_id=${s.c9.section.id}`);
      expect([filtered.status, filtered.body.code]).toEqual([404, 'ATTENDANCE_REPORT_SECTION_NOT_FOUND']);
      expect((await daily(s.otherToken, '?date=2026-11-14')).body.payload.sections).toEqual([]);
      expect((await teachers(s.rinaToken)).status).toBe(403);
    });

    it('assistants see every section but not the teacher report; admins see it; students see none of the reports', async () => {
      const s = await school();
      expect((await daily(s.staffToken, '?date=2026-11-14')).body.payload.sections).toHaveLength(2);
      expect((await teachers(s.staffToken)).status).toBe(403);
      expect((await teachers(s.adminToken)).status).toBe(200);
      const student = s.studentToken(s.rahim);
      expect((await daily(student)).status).toBe(403);
      expect((await monthly(student, s.c8.section.id)).status).toBe(403);
      expect((await teachers(student)).status).toBe(403);
    });

    it("another organisation's staff never see this school's sections or teachers", async () => {
      const s = await school();
      const elsewhere = await organizationWithOwner();
      expect((await daily(elsewhere.ownerToken, `?date=2026-11-14&section_id=${s.c8.section.id}`)).status).toBe(404);
      expect((await monthly(elsewhere.ownerToken, s.c8.section.id)).status).toBe(404);
      expect((await daily(elsewhere.ownerToken, '?date=2026-11-14')).body.payload.sections).toEqual([]);
      expect((await teachers(elsewhere.ownerToken, '?from=2026-11-01&to=2026-11-15')).body.payload.teachers).toEqual([]);
    });
  });

  describe('a realistic month (no summary table needed)', () => {
    it('answers for 40 students × 6 classes a day × 26 days quickly', async () => {
      setNow('2026-12-01T06:00:00Z');
      const base = await organizationWithOwner();
      const c10 = await base.newSection('Class 10');
      const students: UserEntity[] = [];
      for (let i = 1; i <= 40; i++) students.push(await base.student(`Student ${i}`, [c10.classEntity], String(i)));
      const days = [1, 2, 3, 4, 6, 7]; // Saturday to Thursday; Friday off
      const times = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
      // The schedule screen takes 30 slots a section (MAX_SLOTS_PER_SECTION): five days through it, Thursday copied in.
      await base.setSlots(
        c10.section.id,
        days.slice(0, 5).flatMap((day) => times.map((time) => ({ day_of_week: day, start_time: time, end_time: `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`, teacher_id: null }))),
      );
      await t.dataSource.query(
        `INSERT INTO routine_slots (organization_id, session_id, section_id, day_of_week, start_time, end_time, created_at)
         SELECT organization_id, session_id, section_id, $2, start_time, end_time, created_at FROM routine_slots WHERE section_id = $1 AND day_of_week = $3`,
        [c10.section.id, days[5], days[0]],
      );
      // Every class of November held, with a record per student (a mix of marks), as the closing job leaves them.
      await t.dataSource.query(
        `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at, status)
         SELECT rs.organization_id, rs.section_id, rs.id, d::date,
                (d::date + rs.start_time) AT TIME ZONE 'Asia/Dhaka', (d::date + rs.end_time) AT TIME ZONE 'Asia/Dhaka', 'CLOSED'
         FROM routine_slots rs CROSS JOIN generate_series('2026-11-01'::date, '2026-11-30'::date, interval '1 day') d
         WHERE rs.section_id = $1 AND rs.is_active = '1' AND extract(isodow FROM d) = rs.day_of_week`,
        [c10.section.id],
      );
      await t.dataSource.query(
        `INSERT INTO class_attendance_records (organization_id, class_attendance_id, date, person_id, person_type, status, source)
         SELECT s.organization_id, s.id, s.date, e.student_id, 'STUDENT',
                (CASE (row_number() OVER ()) % 10 WHEN 0 THEN 'ABSENT' WHEN 1 THEN 'LATE' WHEN 2 THEN 'LEAVE' ELSE 'PRESENT' END)::attendance_status,
                'SELF'
         FROM class_attendance s JOIN enrolments e ON e.section_id = s.section_id AND e.status = 'ACTIVE'
         WHERE s.section_id = $1`,
        [c10.section.id],
      );
      const [{ count }] = (await t.dataSource.query(`SELECT count(*)::int AS count FROM class_attendance_records r JOIN class_attendance s ON s.id = r.class_attendance_id WHERE s.section_id = $1`, [
        c10.section.id,
      ])) as { count: number }[];
      expect(count).toBe(40 * 6 * 26);

      const timed = async <T>(run: () => Promise<T>) => {
        const started = Date.now();
        const result = await run();
        return { result, ms: Date.now() - started };
      };
      const month = await timed(() => monthly(base.ownerToken, c10.section.id));
      expect(month.result.status).toBe(200);
      expect(month.result.body.payload.days).toHaveLength(26);
      expect(month.result.body.payload.classes).toHaveLength(156);
      const counted = month.result.body.payload.counts;
      expect(counted.present + counted.late + counted.absent + counted.leave).toBe(6240);
      const day = await timed(() => daily(base.ownerToken, '?date=2026-11-14'));
      expect(day.result.body.payload.sections[0].counts.students).toBe(40);
      const performance = await timed(() => reports.studentAttendance(base.organization.id, students.map((st) => st.id), '2026-11-01', '2026-11-30'));
      expect([...performance.result.values()].reduce((sum, row) => sum + row.counts.present + row.counts.late + row.counts.absent + row.counts.leave, 0)).toBe(6240);
      // The month's own figures and the Performance read agree for every student.
      for (const row of month.result.body.payload.students) expect(performance.result.get(row.id)).toEqual({ counts: row.counts, attendance_pct: row.attendance_pct });
      process.stdout.write(`P3-07 volume (6240 records): month ${month.ms} ms, daily ${day.ms} ms, studentAttendance ${performance.ms} ms\n`);
      // Generous limits for a shared CI runner; locally each answer takes a fraction of this.
      expect(month.ms).toBeLessThan(3000);
      expect(day.ms).toBeLessThan(2000);
      expect(performance.ms).toBeLessThan(1000);
    });
  });
});
