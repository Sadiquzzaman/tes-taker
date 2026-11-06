import { DeepPartial } from 'typeorm';
import { GuardianEntity, GuardianRelationEnum } from '../../src/academics/entities/guardian.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AttendanceAlertsService } from '../../src/attendance/attendance-alerts.service';
import { AttendanceClock } from '../../src/attendance/attendance-clock';
import { AttendanceCorrectionEntity } from '../../src/attendance/entities/attendance-correction.entity';
import { AttendanceRecordEntity } from '../../src/attendance/entities/attendance-record.entity';
import { ClassSessionEntity } from '../../src/attendance/entities/class-session.entity';
import { LeaveRequestEntity, LeaveStatusEnum } from '../../src/attendance/entities/leave-request.entity';
import { MARK_LETTERS } from '../../src/attendance/paper-register-csv';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { HolidayEntity } from '../../src/calendar/entities/holiday.entity';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { FeatureOverrideEntity } from '../../src/subscriptions/entities/feature-override.entity';
import { EntitlementsService } from '../../src/subscriptions/entitlements.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: unknown };
type RegisterView = {
  section: { id: string; name: string; class_name: string };
  month: string;
  mode: string;
  can_import: boolean;
  classes: { header: string; date: string; start_time: string; slot_id: string }[];
  students: { id: string; full_name: string; roll_no: string | null; marks: (string | null)[] }[];
};
type Cell = { column: number; value: string; status: string | null; old_status: string | null; change: string | null; issues: string[]; notes: string[] };
type Preview = {
  valid: boolean;
  columns: { column: number; header: string; date: string | null; closed: string | null; marks: number; issues: string[] }[];
  rows: { row: number; student: { id: string } | null; marks: number; issues: string[]; notes: string[]; cells: Cell[] }[];
  summary: { new: number; changed: number; unchanged: number; kept: number; check_ins: number };
};

const MON = 1;
const SAT = 6;
const MONTH = '2026-11';
/** Sunday 15 Nov 2026, 12:00 in Dhaka. */
const NOW = '2026-11-15T06:00:00Z';
/** 23:59 in Dhaka on a school date. */
const endOf = (date: string) => `${date}T17:59:00Z`;

/**
 * The paper register (P3-05; ATT-17, ATT-13 export): the template and export per section and
 * month, the per-column, per-row and per-cell check, an idempotent import with corrections and
 * their trail, approved leave kept, self check-ins only replaced when asked, the export read back
 * in, the guardians' absence SMS held back until the register is in, a self check-in section
 * refusing an import, who may do what, and tenancy.
 */
describe('paper register API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: AttendanceClock;
  let audit: AuditService;
  let alerts: AttendanceAlertsService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role: OrganizationMemberRoleEnum) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const setNow = (iso: string) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const view = (token: string, sectionId: string, month = MONTH) => call<RegisterView>('GET', `/attendance/register/sections/${sectionId}?month=${month}`, token);
  const preview = (token: string, sectionId: string, file: unknown) => call<Preview>('POST', `/attendance/register/sections/${sectionId}/preview`, token, file);
  const apply = (token: string, sectionId: string, file: unknown) => call<Preview>('POST', `/attendance/register/sections/${sectionId}/import`, token, file);
  /** A file as the browser sends it: the header and each line's cells. */
  const file = (header: string[], lines: string[][], extra: Record<string, unknown> = {}) => ({ month: MONTH, header, rows: lines.map((cells) => ({ cells })), ...extra });
  const recordsOf = (sectionId: string) =>
    t.dataSource
      .getRepository(AttendanceRecordEntity)
      .createQueryBuilder('r')
      .innerJoin(ClassSessionEntity, 's', 's.id = r.class_attendance_id')
      .where('s.section_id = :sectionId', { sectionId })
      .orderBy('r.date', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getMany();
  const outbox = (organizationId: string, eventType: string) =>
    t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { organization_id: organizationId, event_type: eventType }, order: { created_at: 'ASC' } });

  const feature = async (organization: OrganizationEntity, value: boolean) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value, reason: 'P3-05 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /**
   * A school whose Class 8 A keeps a paper register: it meets Mondays 16:00–17:00 and Saturdays
   * 16:00–17:30 (teacher Rina named on Saturdays). Rahim (roll 1) and Karim (roll 2) are in it;
   * Rahim is also in Class 9 A (self check-in, Saturdays 18:00–19:00). Monday 9 Nov is a holiday,
   * Fridays are off, Monday 16 Nov is cancelled. Each student has a guardian.
   */
  const school = async () => {
    setNow(NOW);
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    await feature(organization, true);
    await t.dataSource
      .getRepository(FeatureOverrideEntity)
      .save({ organization_id: organization.id, key: 'sms_credits_per_month', value: 20 } as DeepPartial<FeatureOverrideEntity>);
    await t.app.get(EntitlementsService).invalidate(organization.id);
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
    const other = await make.teacher({ personal_teacher_enabled: false, full_name: 'Other Teacher' });
    await make.member(organization, other, OrganizationMemberRoleEnum.TEACHER);
    const student = async (name: string, roll: string, classes: ClassEntity[]) => {
      const user = await make.student({ full_name: name });
      await make.member(organization, user, OrganizationMemberRoleEnum.STUDENT);
      for (const classEntity of classes) {
        const enrolment = await make.enrol(classEntity, user);
        await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z', roll_no = $2 WHERE id = $1`, [enrolment.id, roll]);
      }
      return { user, token: orgSession(user, organization, OrganizationMemberRoleEnum.STUDENT) };
    };
    const rahim = await student('Rahim', '1', [c8.classEntity, c9.classEntity]);
    const karim = await student('Karim', '2', [c8.classEntity]);
    const guardian = (studentId: string, phone: string) =>
      t.dataSource.getRepository(GuardianEntity).save({
        organization_id: organization.id,
        student_id: studentId,
        name: 'Test Guardian',
        relation: GuardianRelationEnum.FATHER,
        phone,
        is_primary: true,
        sms_locale: 'en',
      } as DeepPartial<GuardianEntity>);
    const father = await guardian(rahim.user.id, '01700000001');
    const mother = await guardian(karim.user.id, '01800000002');

    expect((await call('PUT', `/attendance/setup/sections/${c8.section.id}/slots`, ownerToken, {
      slots: [
        { day_of_week: MON, start_time: '16:00', end_time: '17:00', teacher_id: null },
        { day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: teacher.id },
      ],
    })).status).toBe(200);
    expect((await call('PUT', `/attendance/setup/sections/${c9.section.id}/slots`, ownerToken, {
      slots: [{ day_of_week: SAT, start_time: '18:00', end_time: '19:00', teacher_id: null }],
    })).status).toBe(200);
    expect((await call('PATCH', `/attendance/setup/sections/${c8.section.id}`, ownerToken, { mode: 'PAPER_REGISTER', class_type: 'ONLINE' })).status).toBe(200);
    expect((await call('PATCH', `/attendance/setup/sections/${c9.section.id}`, ownerToken, { class_type: 'ONLINE' })).status).toBe(200);
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id IN ($1, $2)`, [c8.section.id, c9.section.id]);
    await t.dataSource.getRepository(HolidayEntity).save({ organization_id: organization.id, date_from: '2026-11-09', date_to: '2026-11-09', name: 'Closed' } as DeepPartial<HolidayEntity>);
    const slots = (await t.dataSource.query(`SELECT id, section_id, day_of_week FROM routine_slots WHERE section_id IN ($1, $2) AND is_active = '1'`, [
      c8.section.id,
      c9.section.id,
    ])) as { id: string; section_id: string; day_of_week: number }[];
    const slot = (sectionId: string, day: number) => (slots.find((s) => s.section_id === sectionId && s.day_of_week === day) as { id: string }).id;
    expect((await call('POST', `/attendance/sessions/${slot(c8.section.id, MON)}/2026-11-16/cancel`, ownerToken, {})).status).toBe(200);
    return {
      owner,
      organization,
      ownerToken,
      teacher,
      teacherToken: orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER),
      otherToken: orgSession(other, organization, OrganizationMemberRoleEnum.TEACHER),
      rahim,
      karim,
      father,
      mother,
      c8,
      c9,
      monday8: slot(c8.section.id, MON),
      saturday8: slot(c8.section.id, SAT),
      saturday9: slot(c9.section.id, SAT),
    };
  };
  type School = Awaited<ReturnType<typeof school>>;
  const HEADER = ['roll_no', 'name'];

  /** A saved record of a class (as a check-in, the closing job or leave approval would leave it). */
  const saveRecord = async (s: School, slotId: string, date: string, personId: string, values: Partial<AttendanceRecordEntity>) => {
    await t.dataSource.query(
      `INSERT INTO class_attendance (organization_id, section_id, routine_slot_id, date, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [s.organization.id, s.c8.section.id, slotId, date, `${date}T10:00:00Z`, `${date}T11:30:00Z`],
    );
    const [session] = (await t.dataSource.query(`SELECT id FROM class_attendance WHERE routine_slot_id = $1 AND date = $2`, [slotId, date])) as { id: string }[];
    return t.dataSource.getRepository(AttendanceRecordEntity).save({
      organization_id: s.organization.id,
      class_attendance_id: session.id,
      date,
      person_id: personId,
      person_type: 'STUDENT',
      ...values,
    } as DeepPartial<AttendanceRecordEntity>);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(AttendanceClock);
    audit = t.app.get(AuditService);
    alerts = t.app.get(AttendanceAlertsService);
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

  describe('template and export (ATT-17, ATT-13)', () => {
    it('lists the class days of the month without holidays, off days or cancelled classes, and every student', async () => {
      const s = await school();
      const response = await view(s.ownerToken, s.c8.section.id);
      expect(response.status).toBe(200);
      const register = response.body.payload;
      expect(register).toMatchObject({ month: MONTH, mode: 'PAPER_REGISTER', can_import: true, section: { name: 'A', class_name: 'Class 8' } });
      // Mondays 2, 23, 30 (9th a holiday, 16th cancelled) and Saturdays 7, 14, 21, 28.
      expect(register.classes.map((c) => c.header)).toEqual(['2026-11-02', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-23', '2026-11-28', '2026-11-30']);
      expect(register.students.map((st) => [st.roll_no, st.full_name, st.marks.every((m) => m === null)])).toEqual([
        ['1', 'Rahim', true],
        ['2', 'Karim', true],
      ]);

      const sections = await call<{ id: string; mode: string }[]>('GET', '/attendance/register/sections', s.ownerToken);
      expect(sections.body.payload.map((section) => [section.id, section.mode])).toEqual([
        [s.c8.section.id, 'PAPER_REGISTER'],
        [s.c9.section.id, 'SELF_CHECKIN'],
      ]);
      expect((await view(s.ownerToken, s.c8.section.id, '2026-13')).status).toBe(400);
    });

    it('a self check-in section can be exported but refuses a paper import', async () => {
      const s = await school();
      const register = (await view(s.ownerToken, s.c9.section.id)).body.payload;
      expect(register).toMatchObject({ mode: 'SELF_CHECKIN', can_import: false });
      const body = file(HEADER.concat('2026-11-14'), [['1', 'Rahim', 'P']]);
      for (const send of [preview, apply]) {
        const response = await send(s.ownerToken, s.c9.section.id, body);
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('ATTENDANCE_REGISTER_SELF_CHECKIN');
      }
      expect(await recordsOf(s.c9.section.id)).toEqual([]);
    });
  });

  describe('the check before anything is saved', () => {
    it('reports every kind of problem per column, row and cell, and refuses the import', async () => {
      const s = await school();
      const header = [
        'roll_no', 'name',
        '2026-11-07', // fine
        '14/11/2026', // fine (a spreadsheet's rewrite)
        '2026-11-10', // Tuesday: no class
        '2026-11-09', // holiday
        '2026-11-13', // Friday: weekly off
        '2026-11-16', // cancelled
        '2026-11-21', // not started yet
        'notes', // not a date
        '2026-12-05', // another month
        '2026-11-02 18:00', // no class at that time
      ];
      const lines = [
        ['1', 'Rahim', 'P', 'উ', 'P', 'P', 'P', 'P', 'P', 'x', 'P', 'P'],
        ['2', 'Karim', 'X', 'দে', '', '', '', '', '', '', '', ''],
        ['9', 'Nobody', 'P', '', '', '', '', '', '', '', '', ''],
        ['', 'Karim', 'A', '', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', '', ''],
      ];
      const response = await preview(s.ownerToken, s.c8.section.id, file(header, lines));
      expect(response.status).toBe(200);
      const result = response.body.payload;
      expect(result.valid).toBe(false);
      expect(result.columns.map((c) => [c.header, c.issues])).toEqual([
        ['2026-11-07', []],
        ['14/11/2026', []],
        ['2026-11-10', ['NOT_CLASS_DAY']],
        ['2026-11-09', ['CLOSED_DAY']],
        ['2026-11-13', ['CLOSED_DAY']],
        ['2026-11-16', ['CANCELLED']],
        ['2026-11-21', ['NOT_STARTED']],
        ['notes', ['COLUMN_UNKNOWN']],
        ['2026-12-05', ['COLUMN_NOT_IN_MONTH']],
        ['2026-11-02 18:00', ['NOT_CLASS_TIME']],
      ]);
      expect(result.columns.filter((c) => c.closed).map((c) => c.closed)).toEqual(['HOLIDAY', 'WEEKLY_OFF']);
      // The empty line is skipped; the rest are checked (line numbers count the header).
      expect(result.rows.map((r) => [r.row, r.issues])).toEqual([
        [2, []],
        [3, []],
        [4, ['STUDENT_NOT_FOUND']],
        [5, ['STUDENT_DUPLICATE']],
      ]);
      const karim = result.rows[1];
      expect(karim.cells.map((c) => [c.value, c.status, c.issues])).toEqual([
        ['X', null, ['STATUS_INVALID']],
        ['দে', 'LATE', []],
      ]);
      expect(result.rows[0].cells.map((c) => [c.value, c.status, c.change])).toEqual([
        ['P', 'PRESENT', 'NEW'],
        ['উ', 'PRESENT', 'NEW'],
      ]);

      const refused = await apply(s.ownerToken, s.c8.section.id, file(header, lines));
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('ATTENDANCE_REGISTER_INVALID');
      expect(await recordsOf(s.c8.section.id)).toEqual([]);
    });

    it('ignores problem columns and unknown students that have no marks', async () => {
      const s = await school();
      const response = await preview(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-07', '2026-11-09', 'notes'), [
        ['1', 'Rahim', 'P', '', ''],
        ['7', 'Left the school', '', '', ''],
      ]));
      expect(response.body.payload).toMatchObject({ valid: true, summary: { new: 1 } });
      expect(response.body.payload.rows[1].issues).toEqual(['STUDENT_NOT_FOUND']);
    });

    it('needs a roll or name column, and a student who joined after a class has no mark in it', async () => {
      const s = await school();
      const missing = await preview(s.ownerToken, s.c8.section.id, file(['2026-11-07'], [['P']]));
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe('ATTENDANCE_REGISTER_COLUMNS_MISSING');

      await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-11-10T00:00:00Z' WHERE student_id = $1`, [s.karim.user.id]);
      const result = (await preview(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-07', '2026-11-14'), [['2', 'Karim', 'P', 'P']]))).body.payload;
      expect(result.valid).toBe(false);
      expect(result.rows[0].cells.map((c) => c.issues)).toEqual([['NOT_JOINED'], []]);
    });
  });

  describe('import', () => {
    it('saves the marks, changes nothing the second time, and corrects changed marks with a trail and an audit row', async () => {
      const s = await school();
      const header = HEADER.concat('2026-11-02', '2026-11-07', '2026-11-14');
      const first = file(header, [
        ['1', 'Rahim', 'P', 'L', 'A'],
        ['02', 'karim', 'অ', 'Leave', ''],
      ], { file_name: 'class-8-a-2026-11.csv' });
      const imported = await apply(s.ownerToken, s.c8.section.id, first);
      expect(imported.status).toBe(200);
      expect(imported.body.payload.summary).toEqual({ new: 5, changed: 0, unchanged: 0, kept: 0, check_ins: 0 });
      const saved = await recordsOf(s.c8.section.id);
      expect(saved.map((r) => [r.date, r.person_id === s.rahim.user.id ? 'Rahim' : 'Karim', r.status, r.source]).sort()).toEqual([
        ['2026-11-02', 'Karim', 'ABSENT', 'IMPORT'],
        ['2026-11-02', 'Rahim', 'PRESENT', 'IMPORT'],
        ['2026-11-07', 'Karim', 'LEAVE', 'IMPORT'],
        ['2026-11-07', 'Rahim', 'LATE', 'IMPORT'],
        ['2026-11-14', 'Rahim', 'ABSENT', 'IMPORT'],
      ]);

      // The same file again: nothing changes.
      const again = await apply(s.ownerToken, s.c8.section.id, first);
      expect(again.body.payload.summary).toEqual({ new: 0, changed: 0, unchanged: 5, kept: 0, check_ins: 0 });
      expect((await recordsOf(s.c8.section.id)).map((r) => [r.id, r.status])).toEqual(saved.map((r) => [r.id, r.status]));
      expect(await t.dataSource.getRepository(AttendanceCorrectionEntity).count({ where: { organization_id: s.organization.id } })).toBe(0);

      // Re-imported with one mark changed and one blank (a blank never removes a mark).
      const changed = file(header, [
        ['1', 'Rahim', 'P', 'L', 'P'],
        ['2', 'Karim', '', 'Leave', ''],
      ]);
      const preview2 = (await preview(s.ownerToken, s.c8.section.id, changed)).body.payload;
      expect(preview2.rows[0].cells[2]).toMatchObject({ old_status: 'ABSENT', status: 'PRESENT', change: 'CHANGE' });
      const result = await apply(s.ownerToken, s.c8.section.id, changed);
      expect(result.body.payload.summary).toEqual({ new: 0, changed: 1, unchanged: 3, kept: 0, check_ins: 0 });
      const corrections = await t.dataSource.getRepository(AttendanceCorrectionEntity).find({ where: { organization_id: s.organization.id } });
      expect(corrections.map((c) => [c.old_status, c.new_status, c.reason, c.corrected_by])).toEqual([['ABSENT', 'PRESENT', 'Paper register import', s.owner.id]]);
      expect((await recordsOf(s.c8.section.id)).filter((r) => r.status !== 'PRESENT' || r.date !== '2026-11-14')).toHaveLength(4);

      // The class view shows the trail, as for any correction.
      const detail = await call<{ students: { person: { id: string }; status: string; corrections: unknown[] }[] }>(
        'GET', `/attendance/sessions/${s.saturday8}/2026-11-14`, s.ownerToken,
      );
      const rahim = detail.body.payload.students.find((row) => row.person.id === s.rahim.user.id) as { status: string; corrections: unknown[] };
      expect(rahim.status).toBe('PRESENT');
      expect(rahim.corrections).toHaveLength(1);

      await audit.flush();
      const rows = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id, action: 'attendance.import' }, order: { created_at: 'ASC' } });
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ actor_id: s.owner.id, entity_type: 'section', entity_id: s.c8.section.id });
      expect(rows[0].after).toMatchObject({ month: MONTH, file_name: 'class-8-a-2026-11.csv', new: 5, dates: ['2026-11-02', '2026-11-07', '2026-11-14'] });
      expect(rows[2].after).toMatchObject({ changed: 1, dates: ['2026-11-14'] });
    });

    it('never overwrites approved leave, and saves Absent on a day of approved leave as Leave', async () => {
      const s = await school();
      const leaveRepo = t.dataSource.getRepository(LeaveRequestEntity);
      const leave = await leaveRepo.save({
        organization_id: s.organization.id,
        person_id: s.karim.user.id,
        person_type: 'STUDENT',
        from_date: '2026-11-02',
        to_date: '2026-11-07',
        reason: 'Family event',
        status: LeaveStatusEnum.APPROVED,
        decided_at: new Date('2026-11-01T00:00:00Z'),
      } as DeepPartial<LeaveRequestEntity>);
      // 2 Nov already holds the Leave saved from the request (as an approval leaves it).
      await saveRecord(s, s.monday8, '2026-11-02', s.karim.user.id, { status: 'LEAVE', source: 'CORRECTION', leave_request_id: leave.id } as Partial<AttendanceRecordEntity>);

      const body = file(HEADER.concat('2026-11-02', '2026-11-07'), [['2', 'Karim', 'P', 'A']]);
      const checked = (await preview(s.ownerToken, s.c8.section.id, body)).body.payload;
      expect(checked.rows[0].cells.map((c) => [c.change, c.status, c.notes])).toEqual([
        ['KEEP', 'LEAVE', ['LEAVE_KEPT']],
        ['NEW', 'LEAVE', ['ON_LEAVE']],
      ]);
      const result = await apply(s.ownerToken, s.c8.section.id, body);
      expect(result.body.payload.summary).toMatchObject({ new: 1, kept: 1, changed: 0 });
      const saved = await recordsOf(s.c8.section.id);
      expect(saved.map((r) => [r.date, r.status, r.leave_request_id])).toEqual([
        ['2026-11-02', 'LEAVE', leave.id],
        ['2026-11-07', 'LEAVE', leave.id],
      ]);
      // And again: nothing changes.
      expect((await apply(s.ownerToken, s.c8.section.id, body)).body.payload.summary).toMatchObject({ new: 0, changed: 0, unchanged: 1, kept: 1 });
    });

    it('shows a self check-in the file disagrees with, and replaces it only when asked', async () => {
      const s = await school();
      // Rahim checked in himself on 7 Nov (before the section switched to paper).
      const own = await saveRecord(s, s.saturday8, '2026-11-07', s.rahim.user.id, {
        status: 'LATE', source: 'SELF', checked_in_at: new Date('2026-11-07T10:20:00Z'), late_minutes: 20,
      } as Partial<AttendanceRecordEntity>);
      const body = file(HEADER.concat('2026-11-07'), [['1', 'Rahim', 'P'], ['2', 'Karim', 'P']]);
      const checked = (await preview(s.ownerToken, s.c8.section.id, body)).body.payload;
      expect(checked.valid).toBe(true);
      expect(checked.rows[0].cells[0]).toMatchObject({ old_status: 'LATE', status: 'PRESENT', change: 'CHANGE', notes: ['SELF_CHECKIN'] });
      expect(checked.summary).toEqual({ new: 1, changed: 0, unchanged: 0, kept: 0, check_ins: 1 });

      const kept = await apply(s.ownerToken, s.c8.section.id, body);
      expect(kept.body.payload.summary).toEqual({ new: 1, changed: 0, unchanged: 0, kept: 1, check_ins: 0 });
      expect(await t.dataSource.getRepository(AttendanceRecordEntity).findOneByOrFail({ id: own.id })).toMatchObject({ status: 'LATE', source: 'SELF' });

      const replaced = await apply(s.ownerToken, s.c8.section.id, { ...body, overwrite_check_ins: true });
      expect(replaced.body.payload.summary).toEqual({ new: 0, changed: 0, unchanged: 1, kept: 0, check_ins: 1 });
      const after = await t.dataSource.getRepository(AttendanceRecordEntity).findOneByOrFail({ id: own.id });
      // The check-in time stays on the record; the correction keeps the old status.
      expect(after).toMatchObject({ status: 'PRESENT', source: 'IMPORT', late_minutes: null });
      expect(after.checked_in_at).toEqual(new Date('2026-11-07T10:20:00Z'));
      const [correction] = await t.dataSource.getRepository(AttendanceCorrectionEntity).find({ where: { record_id: own.id } });
      expect(correction).toMatchObject({ old_status: 'LATE', new_status: 'PRESENT', reason: 'Paper register import' });
    });

    it('reads its own export back in: nothing changes', async () => {
      const s = await school();
      const header = HEADER.concat('2026-11-02', '2026-11-07', '2026-11-14');
      await apply(s.ownerToken, s.c8.section.id, file(header, [['1', 'Rahim', 'P', 'L', 'A'], ['2', 'Karim', 'A', 'Leave', 'P']]));

      for (const language of ['en', 'bn'] as const) {
        const register = (await view(s.ownerToken, s.c8.section.id)).body.payload;
        // The CSV the web app writes: roll, name, one column per class, the letters of the user's language.
        const exported = file(
          HEADER.concat(register.classes.map((c) => c.header)),
          register.students.map((st) => [st.roll_no ?? '', st.full_name, ...st.marks.map((m) => (m ? MARK_LETTERS[language][m as 'PRESENT'] : ''))]),
        );
        expect(exported.rows[0].cells.slice(2, 5)).toEqual(language === 'en' ? ['P', 'L', 'A'] : ['উ', 'দে', 'অ']);
        const checked = (await preview(s.ownerToken, s.c8.section.id, exported)).body.payload;
        expect(checked).toMatchObject({ valid: true, summary: { new: 0, changed: 0, unchanged: 6, kept: 0, check_ins: 0 } });
        expect((await apply(s.ownerToken, s.c8.section.id, exported)).body.payload.summary.unchanged).toBe(6);
      }
      expect(await t.dataSource.getRepository(AttendanceCorrectionEntity).count({ where: { organization_id: s.organization.id } })).toBe(0);
    });

    it('a class with two classes that day needs the start time in the header', async () => {
      const s = await school();
      expect((await call('PUT', `/attendance/setup/sections/${s.c8.section.id}/slots`, s.ownerToken, {
        slots: [
          { day_of_week: SAT, start_time: '08:00', end_time: '09:00', teacher_id: null },
          { day_of_week: SAT, start_time: '16:00', end_time: '17:30', teacher_id: s.teacher.id },
        ],
      })).status).toBe(200);
      await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id = $1`, [s.c8.section.id]);
      const register = (await view(s.ownerToken, s.c8.section.id)).body.payload;
      expect(register.classes.slice(0, 2).map((c) => c.header)).toEqual(['2026-11-07 08:00', '2026-11-07 16:00']);
      const checked = (await preview(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-07', '2026-11-07 16:00', '7/11/2026 4:00 PM'), [['1', 'Rahim', 'P', 'P', 'P']]))).body.payload;
      expect(checked.columns.map((c) => c.issues)).toEqual([['TIME_NEEDED'], [], ['DUPLICATE_COLUMN']]);
    });
  });

  describe('the guardians’ absence SMS held back until the register is in (P3-04)', () => {
    it('goes out after the import only for students who missed every class that day, once', async () => {
      const s = await school();
      // Saturday 14 Nov: Rahim attends Class 9 A (self check-in); the paper register is not in yet.
      setNow('2026-11-14T12:05:00Z');
      expect((await call('POST', '/attendance/check-in', s.rahim.token, { slot_id: s.saturday9 })).status).toBe(200);
      setNow(endOf('2026-11-14'));
      await alerts.endOfDay();
      expect(await outbox(s.organization.id, 'attendance.absent')).toEqual([]);

      // Sunday noon the register comes in: both missed Class 8 A; only Karim missed every class.
      setNow(NOW);
      const body = file(HEADER.concat('2026-11-14'), [['1', 'Rahim', 'A'], ['2', 'Karim', 'A']]);
      expect((await apply(s.teacherToken, s.c8.section.id, body)).status).toBe(200);
      const rows = await outbox(s.organization.id, 'attendance.absent');
      expect(rows.map((r) => [r.recipient_id, (r.payload as { absent_on: string }).absent_on])).toEqual([[s.mother.id, '2026-11-14']]);
      // No Late SMS for paper registers.
      expect(await outbox(s.organization.id, 'attendance.late')).toEqual([]);

      // Importing again, or the night job, sends nothing more.
      await apply(s.teacherToken, s.c8.section.id, body);
      setNow('2026-11-15T01:00:00Z');
      await alerts.endOfDay();
      expect(await outbox(s.organization.id, 'attendance.absent')).toHaveLength(1);
    });

    it('is held back while any of the student’s paper classes that day has no mark, and not sent for old days', async () => {
      const s = await school();
      // Karim is marked on 7 Nov (8 days ago): the register counts, but no SMS so late.
      setNow(NOW);
      await apply(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-07'), [['2', 'Karim', 'A']]));
      expect(await outbox(s.organization.id, 'attendance.absent')).toEqual([]);

      // Monday 23 Nov: the register has Karim but not Rahim, imported at 23:59.
      setNow(endOf('2026-11-23'));
      await apply(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-23'), [['2', 'Karim', 'L']]));
      await alerts.endOfDay();
      // Rahim's day is not known yet; Karim was late, not absent.
      expect(await outbox(s.organization.id, 'attendance.absent')).toEqual([]);
      await apply(s.ownerToken, s.c8.section.id, file(HEADER.concat('2026-11-23'), [['1', 'Rahim', 'A'], ['2', 'Karim', 'L']]));
      expect((await outbox(s.organization.id, 'attendance.absent')).map((r) => r.recipient_id)).toEqual([s.father.id]);
    });
  });

  describe('who may import', () => {
    it("the section's teacher imports; teachers change saved marks only within 7 days; others cannot see the section", async () => {
      const s = await school();
      const header = HEADER.concat('2026-11-02', '2026-11-14');
      // A teacher named on the section's class fills in a register from two weeks ago.
      const first = await apply(s.teacherToken, s.c8.section.id, file(header, [['1', 'Rahim', 'P', 'P']]));
      expect(first.status).toBe(200);
      expect(first.body.payload.summary.new).toBe(2);
      // Changing the 2 Nov mark is a correction older than 7 days: the owner can, the teacher cannot.
      const change = file(header, [['1', 'Rahim', 'A', 'L']]);
      const byTeacher = (await preview(s.teacherToken, s.c8.section.id, change)).body.payload;
      expect(byTeacher.valid).toBe(false);
      expect(byTeacher.rows[0].cells.map((c) => c.issues)).toEqual([['TOO_OLD'], []]);
      expect((await preview(s.ownerToken, s.c8.section.id, change)).body.payload.valid).toBe(true);

      // Another teacher, a student: no access.
      expect((await view(s.otherToken, s.c8.section.id)).status).toBe(404);
      expect((await apply(s.otherToken, s.c8.section.id, change)).status).toBe(404);
      expect((await view(s.rahim.token, s.c8.section.id)).status).toBe(403);
      expect((await call('GET', '/attendance/register/sections', s.otherToken)).body.payload).toEqual([]);
    });

    it("never touches another organisation's section, and needs the attendance feature", async () => {
      const s = await school();
      const other = await school();
      const body = file(HEADER.concat('2026-11-14'), [['1', 'Rahim', 'P']]);
      expect((await view(other.ownerToken, s.c8.section.id)).status).toBe(404);
      const refused = await apply(other.ownerToken, s.c8.section.id, body);
      expect(refused.status).toBe(404);
      expect(refused.body.code).toBe('ATTENDANCE_REGISTER_SECTION_NOT_FOUND');
      expect(await recordsOf(s.c8.section.id)).toEqual([]);

      await feature(s.organization, false);
      expect((await view(s.ownerToken, s.c8.section.id)).status).toBe(403);
      expect((await apply(s.ownerToken, s.c8.section.id, body)).status).toBe(403);
    });
  });
});
