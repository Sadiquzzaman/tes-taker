import { DeepPartial } from 'typeorm';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from '../../src/academics/entities/academic-session.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string; teacher_id: string | null };
type Row = { id: string; name: string; class: { name: string }; branch_id: string; class_type: string; mode: string; grace_minutes: number | null; slots: Slot[] };
type Preview = {
  session: { id: string; name: string };
  valid: boolean;
  rows: { row: number; class: string | null; section: string | null; days: number[]; start: string | null; end: string | null; errors: string[] }[];
  sections: { id: string; name: string; class_name: string; slots_before: number; slots_after: number; settings_changed: boolean }[];
};
type Body<T> = { payload: T; code?: string; feature?: string; message?: string };
type CsvRow = Partial<Record<'class' | 'section' | 'days' | 'start' | 'end' | 'class_type' | 'mode' | 'grace' | 'branch', string>>;

/** A coaching centre's file: two lines for 6 A, one for 6 B (with its settings). */
const FILE: CsvRow[] = [
  { class: 'Class 6', section: 'A', days: 'Sat;Mon', start: '16:00', end: '17:30' },
  { class: 'class 6', section: 'a', days: 'বুধ', start: '6:00 PM', end: '7:00 pm' },
  { class: 'Class 6', section: 'B', days: 'Sun;Tue;Thu', start: '09:00', end: '10:30', class_type: 'Online', mode: 'Paper register', grace: '5' },
];
const times = (slots: Pick<Slot, 'day_of_week' | 'start_time' | 'end_time'>[]) =>
  slots.map((slot) => `${slot.day_of_week} ${slot.start_time}-${slot.end_time}`).sort();

/**
 * Schedule CSV import (P3-02, ATT-16): preview with problems per row, an all-or-nothing import that
 * gives each listed section exactly its times, the same file twice changing nothing, kept teachers,
 * permissions, the plan gate, tenancy and audit.
 */
describe('schedule CSV import API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const preview = (token: string, rows: CsvRow[], extra: object = {}) => call<Preview>('POST', '/attendance/setup/import/preview', token, { rows, ...extra });
  const importFile = (token: string, rows: CsvRow[]) => call<Preview>('POST', '/attendance/setup/import', token, { rows });
  const grid = async (token: string) => (await call<{ sections: Row[]; main_branch_id: string }>('GET', '/attendance/setup', token)).body.payload;
  const rowOf = async (token: string, id: string) => (await grid(token)).sections.find((row) => row.id === id) as Row;

  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) {
      const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
        body: { value: true, reason: 'P3-02 test' },
        token: t.tokenFor(admin),
      });
      expect(response.status).toBe(200);
    }
    const token = orgSession(owner, organization);
    const class6 = (await call<{ id: string }>('POST', '/classes', token, { class_name: 'Class 6' })).body.payload.id;
    const class7 = (await call<{ id: string }>('POST', '/classes', token, { class_name: 'Class 7' })).body.payload.id;
    expect((await call('POST', `/classes/${class6}/sections`, token, { name: 'B' })).status).toBe(201);
    const sections = t.dataSource.getRepository(SectionEntity);
    return {
      owner,
      organization,
      token,
      class6,
      s6A: await sections.findOneByOrFail({ class_id: class6, name: 'A' }),
      s6B: await sections.findOneByOrFail({ class_id: class6, name: 'B' }),
      s7A: await sections.findOneByOrFail({ class_id: class7, name: 'A' }),
    };
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

  it('previews a file without saving, then gives each listed section exactly its times and settings', async () => {
    const { token, s6A, s6B, s7A } = await school();
    await call('PUT', `/attendance/setup/sections/${s7A.id}/slots`, token, { slots: [{ day_of_week: 2, start_time: '08:00', end_time: '09:00' }] });
    await call('PUT', `/attendance/setup/sections/${s6A.id}/slots`, token, { slots: [{ day_of_week: 5, start_time: '08:00', end_time: '09:00' }] });

    const checked = await preview(token, FILE);
    expect(checked.status).toBe(200);
    expect(checked.body.payload.valid).toBe(true);
    expect(checked.body.payload.rows.map((row) => [row.row, row.days, row.start, row.end, row.errors])).toEqual([
      [2, [6, 1], '16:00', '17:30', []],
      [3, [3], '18:00', '19:00', []],
      [4, [7, 2, 4], '09:00', '10:30', []],
    ]);
    expect(checked.body.payload.sections).toEqual([
      { id: s6A.id, name: 'A', class_name: 'Class 6', slots_before: 1, slots_after: 3, settings_changed: false },
      { id: s6B.id, name: 'B', class_name: 'Class 6', slots_before: 0, slots_after: 3, settings_changed: true },
    ]);
    expect((await rowOf(token, s6A.id)).slots).toHaveLength(1);

    const imported = await importFile(token, FILE);
    expect(imported.status).toBe(200);
    expect(times((await rowOf(token, s6A.id)).slots)).toEqual(['1 16:00-17:30', '3 18:00-19:00', '6 16:00-17:30']);
    const sixB = await rowOf(token, s6B.id);
    expect(times(sixB.slots)).toEqual(['2 09:00-10:30', '4 09:00-10:30', '7 09:00-10:30']);
    expect(sixB).toMatchObject({ class_type: 'ONLINE', mode: 'PAPER_REGISTER', grace_minutes: 5 });
    // A section not in the file is left alone.
    expect(times((await rowOf(token, s7A.id)).slots)).toEqual(['2 08:00-09:00']);

    // The same file again changes nothing: same slot rows, and the preview says so.
    const ids = (await rowOf(token, s6A.id)).slots.map((slot) => slot.id).sort();
    const again = await preview(token, FILE);
    expect(again.body.payload.sections.map((s) => [s.slots_before, s.slots_after, s.settings_changed])).toEqual([
      [3, 3, false],
      [3, 3, false],
    ]);
    expect((await importFile(token, FILE)).status).toBe(200);
    expect((await rowOf(token, s6A.id)).slots.map((slot) => slot.id).sort()).toEqual(ids);

    // "default" puts the organisation's grace period back.
    await importFile(token, [{ ...FILE[2], grace: 'default', class_type: '', mode: '' }]);
    expect(await rowOf(token, s6B.id)).toMatchObject({ class_type: 'ONLINE', mode: 'PAPER_REGISTER', grace_minutes: null });
  });

  it('reports every problem on its row and imports nothing while any row has one', async () => {
    const { token, s6A } = await school();
    const bad: CsvRow[] = [
      { class: 'Class 6', section: 'A', days: 'Sat', start: '16:00', end: '17:00' },
      { class: 'Class 9', section: 'A', days: 'Sat', start: '16:00', end: '17:00' },
      { class: 'Class 6', section: 'Z', days: 'Sat', start: '16:00', end: '17:00' },
      { section: 'A', days: 'Sat', start: '16:00', end: '17:00' },
      { class: 'Class 6', days: 'Sat', start: '16:00', end: '17:00' },
      { class: 'Class 6', section: 'B', days: 'Funday', start: '4', end: '25:00' },
      { class: 'Class 6', section: 'B', days: 'Sun', start: '17:00', end: '16:00' },
      { class: 'Class 6', section: 'A', days: 'Sat;Mon', start: '16:30', end: '17:30' },
      { class: 'Class 7', section: 'A', days: 'Sun', start: '09:00', end: '10:00', class_type: 'hybrid', mode: 'roll call', grace: '90', branch: 'Mars' },
      { class: 'Class 7', section: 'A', days: 'Mon', start: '09:00', end: '10:00', grace: '5' },
      { class: 'Class 7', section: 'A', days: 'Tue', start: '09:00', end: '10:00', grace: '10' },
    ];
    const checked = (await preview(token, bad)).body.payload;
    expect(checked.valid).toBe(false);
    expect(checked.rows.map((row) => [row.row, row.errors])).toEqual([
      [2, []],
      [3, ['CLASS_NOT_FOUND']],
      [4, ['SECTION_NOT_FOUND']],
      [5, ['CLASS_MISSING']],
      [6, ['SECTION_MISSING']],
      [7, ['DAYS_INVALID', 'START_INVALID', 'END_INVALID']],
      [8, ['END_BEFORE_START']],
      [9, ['OVERLAP']],
      [10, ['CLASS_TYPE_INVALID', 'MODE_INVALID', 'GRACE_INVALID', 'BRANCH_NOT_FOUND']],
      [11, []],
      [12, ['SETTINGS_CONFLICT']],
    ]);

    const refused = await importFile(token, bad);
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('ATTENDANCE_SCHEDULE_IMPORT_INVALID');
    expect((await rowOf(token, s6A.id)).slots).toEqual([]);

    // The DTO limits: at least one row, at most 1000.
    expect((await preview(token, [])).status).toBe(400);
    expect((await preview(token, Array.from({ length: 1001 }, () => FILE[0]))).status).toBe(400);
  });

  it('keeps the teacher of a slot the file lists unchanged, and sets branches by name', async () => {
    const { organization, token, s6A, s6B } = await school();
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/attendance/setup/sections/${s6A.id}/slots`, token, {
      slots: [
        { day_of_week: 6, start_time: '16:00', end_time: '17:30', teacher_id: teacher.id },
        { day_of_week: 3, start_time: '18:00', end_time: '19:00', teacher_id: teacher.id },
      ],
    });
    const farmgate = (await call<{ id: string }>('POST', '/attendance/branches', token, { name: 'Farmgate' })).body.payload;

    await importFile(token, [
      { class: 'Class 6', section: 'A', days: 'Sat', start: '16:00', end: '17:30', branch: 'farmgate' },
      { class: 'Class 6', section: 'A', days: 'Wed', start: '18:30', end: '19:30' },
      { class: 'Class 6', section: 'B', days: 'Sat', start: '16:00', end: '17:30', branch: 'Main branch' },
    ]);
    const sixA = await rowOf(token, s6A.id);
    expect(sixA.branch_id).toBe(farmgate.id);
    expect(sixA.slots.map((slot) => [slot.day_of_week, slot.start_time, slot.teacher_id])).toEqual([
      [3, '18:30', null],
      [6, '16:00', teacher.id],
    ]);
    const main = (await grid(token)).main_branch_id;
    expect((await rowOf(token, s6B.id)).branch_id).toBe(main);
  });

  it('lets a teacher import only the sections they teach, without changing branches', async () => {
    const { organization, token, class6, s6A } = await school();
    const teacher = await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    const teacherToken = orgSession(teacher, organization, OrganizationMemberRoleEnum.TEACHER);
    const math = await t.dataSource
      .getRepository(SubjectEntity)
      .save({ name: 'Math', code: 'MATH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    await call('POST', `/classes/${class6}/subjects`, token, { subject_id: math.id });
    const [offering] = (await call<{ id: string }[]>('GET', `/sections/${s6A.id}/offerings`, token)).body.payload;
    await call('PUT', `/offerings/${offering.id}/teachers`, token, { teacher_ids: [teacher.id] });

    const checked = (
      await preview(teacherToken, [
        { class: 'Class 6', section: 'A', days: 'Sat', start: '16:00', end: '17:00' },
        { class: 'Class 6', section: 'B', days: 'Sat', start: '16:00', end: '17:00' },
        { class: 'Class 6', section: 'A', days: 'Mon', start: '16:00', end: '17:00', branch: 'Main' },
      ])
    ).body.payload;
    expect(checked.rows.map((row) => row.errors)).toEqual([[], ['NOT_YOUR_SECTION'], ['BRANCH_NOT_ALLOWED']]);
    expect((await importFile(teacherToken, [{ class: 'Class 6', section: 'A', days: 'Sat', start: '16:00', end: '17:00' }])).status).toBe(200);
    expect((await rowOf(token, s6A.id)).slots).toHaveLength(1);

    const student = await make.student();
    await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
    expect((await preview(orgSession(student, organization, OrganizationMemberRoleEnum.STUDENT), FILE)).status).toBe(403);
  });

  it('refuses a closed session and a plan without attendance', async () => {
    const closed = await school();
    await t.dataSource
      .getRepository(AcademicSessionEntity)
      .update({ organization_id: closed.organization.id }, { status: AcademicSessionStatusEnum.CLOSED });
    expect((await preview(closed.token, FILE)).status).toBe(400);
    expect((await importFile(closed.token, FILE)).status).toBe(400);

    const off = await school({ enabled: false });
    const refused = await preview(off.token, FILE);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN', feature: 'attendance' });
  });

  it("matches only the organisation's own sections and session", async () => {
    const a = await school();
    const b = await school();
    await importFile(a.token, FILE);
    // B's file names the same classes: only B's sections change.
    expect((await importFile(b.token, [FILE[0]])).status).toBe(200);
    expect(times((await rowOf(a.token, a.s6A.id)).slots)).toEqual(['1 16:00-17:30', '3 18:00-19:00', '6 16:00-17:30']);
    expect(times((await rowOf(b.token, b.s6A.id)).slots)).toEqual(['1 16:00-17:30', '6 16:00-17:30']);
    // Another organisation's session id is not found.
    const sessionA = (await preview(a.token, FILE)).body.payload.session.id;
    expect((await preview(b.token, FILE, { session_id: sessionA })).status).toBe(404);
  });

  it('records the import in the audit log as one row per changed section', async () => {
    const { owner, organization, token, s6A, s6B } = await school();
    await importFile(token, FILE);
    await importFile(token, FILE); // nothing changes the second time
    await audit.flush();
    const rows = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: organization.id, entity_type: 'section' } });
    const summary = rows.map((row) => `${row.action} ${row.entity_id === s6A.id ? '6A' : row.entity_id === s6B.id ? '6B' : '?'}`).sort();
    expect(summary).toEqual(['schedule.update 6A', 'schedule.update 6B', 'section_attendance.update 6B']);
    expect(rows.every((row) => row.actor_id === owner.id)).toBe(true);
    expect(rows.filter((row) => row.action === 'schedule.update').every((row) => (row.after as { source: string }).source === 'import')).toBe(true);
  });
});
