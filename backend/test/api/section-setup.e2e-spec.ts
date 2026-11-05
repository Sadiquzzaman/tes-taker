import { DeepPartial } from 'typeorm';
import { AcademicSessionEntity, AcademicSessionStatusEnum } from '../../src/academics/entities/academic-session.entity';
import { SectionEntity } from '../../src/academics/entities/section.entity';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RoutineSlotEntity } from '../../src/calendar/entities/routine-slot.entity';
import { ActiveStatusEnum } from '../../src/common/enums/active-status.enum';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string; teacher_id: string | null; teacher: { id: string; full_name: string } | null };
type Row = {
  id: string;
  name: string;
  class: { id: string; name: string };
  shift: string | null;
  branch_id: string;
  class_type: string;
  mode: string;
  grace_minutes: number | null;
  slots: Slot[];
  can_edit: boolean;
};
type Grid = { session: { id: string; status: string }; late_grace_minutes: number; main_branch_id: string; can_manage: boolean; sections: Row[] };
type Body<T> = { payload: T; code?: string; feature?: string; message?: string; details?: { slot?: number; section?: { name: string; class_name: string } } };

const SAT = 6;
const MON = 1;
const WED = 3;
/** Sat and Mon 16:00–17:30, Wed 18:00–19:00 (a coaching batch). */
const BATCH = [
  { day_of_week: MON, start_time: '16:00', end_time: '17:30' },
  { day_of_week: WED, start_time: '18:00', end_time: '19:00' },
  { day_of_week: SAT, start_time: '16:00', end_time: '17:30' },
];
const times = (slots: Pick<Slot, 'day_of_week' | 'start_time' | 'end_time'>[]) =>
  slots.map((slot) => `${slot.day_of_week} ${slot.start_time}-${slot.end_time}`);

/**
 * Section attendance setup and schedules (P3-02, ATT-16): the grid, per-section settings, weekly
 * slots and their rules, copy, apply to a class or shift, who may do what, closed sessions, the
 * plan gate, tenancy and audit.
 */
describe('section setup API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let audit: AuditService;
  let admin: UserEntity;

  const orgSession = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });

  const grid = (token: string, query = '') => call<Grid>('GET', `/attendance/setup${query}`, token);
  const patchSection = (token: string, id: string, body: unknown) => call<Row>('PATCH', `/attendance/setup/sections/${id}`, token, body);
  const putSlots = (token: string, id: string, slots: unknown[]) => call<Row>('PUT', `/attendance/setup/sections/${id}/slots`, token, { slots });
  const copy = (token: string, id: string, from: string) => call<Row>('POST', `/attendance/setup/sections/${id}/copy`, token, { from_section_id: from });
  const apply = (token: string, body: unknown) =>
    call<{ dry_run: boolean; sections: { id: string; name: string; slots_before: number; teachers_dropped: number }[] }>('POST', '/attendance/setup/apply', token, body);

  const enableAttendance = async (organization: OrganizationEntity) => {
    const response = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/attendance`, {
      body: { value: true, reason: 'P3-02 test' },
      token: t.tokenFor(admin),
    });
    expect(response.status).toBe(200);
  };

  /** A school with Class 6 (sections A morning, B day) and Class 7 (section A morning). */
  const school = async ({ enabled = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    if (enabled) await enableAttendance(organization);
    const token = orgSession(owner, organization);
    const newClass = async (name: string) => {
      const created = await call<{ id: string }>('POST', '/classes', token, { class_name: name });
      expect(created.status).toBe(201);
      return created.body.payload.id;
    };
    const class6 = await newClass('Class 6');
    const class7 = await newClass('Class 7');
    const sections = t.dataSource.getRepository(SectionEntity);
    await sections.update({ class_id: class6 }, { shift: 'MORNING' as SectionEntity['shift'] });
    await sections.update({ class_id: class7 }, { shift: 'MORNING' as SectionEntity['shift'] });
    expect((await call('POST', `/classes/${class6}/sections`, token, { name: 'B', shift: 'DAY' })).status).toBe(201);
    const of = async (classId: string, name: string) => sections.findOneByOrFail({ class_id: classId, name });
    return {
      owner,
      organization,
      token,
      class6,
      class7,
      s6A: await of(class6, 'A'),
      s6B: await of(class6, 'B'),
      s7A: await of(class7, 'A'),
    };
  };

  const memberOf = async (organization: OrganizationEntity, role: OrganizationMemberRoleEnum) => {
    const user = role === OrganizationMemberRoleEnum.STUDENT ? await make.student() : await make.teacher({ personal_teacher_enabled: false });
    await make.member(organization, user, role);
    return { user, token: orgSession(user, organization, role) };
  };

  const rowOf = async (token: string, id: string) => (await grid(token)).body.payload.sections.find((row) => row.id === id) as Row;

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

  it('lists every section of the session with the defaults: main branch, in person, self check-in, the organisation grace', async () => {
    const { token, s6A, s6B, s7A } = await school();
    const response = await grid(token);
    expect(response.status).toBe(200);
    const view = response.body.payload;
    expect(view).toMatchObject({ late_grace_minutes: 10, can_manage: true, session: { status: 'ACTIVE' } });
    expect(view.sections.map((row) => `${row.class.name} ${row.name}`)).toEqual(['Class 6 A', 'Class 6 B', 'Class 7 A']);
    expect(view.sections.map((row) => row.id)).toEqual([s6A.id, s6B.id, s7A.id]);
    for (const row of view.sections) {
      expect(row).toMatchObject({
        branch_id: view.main_branch_id,
        class_type: 'IN_PERSON',
        mode: 'SELF_CHECKIN',
        grace_minutes: null,
        slots: [],
        can_edit: true,
      });
    }
  });

  it('saves a weekly schedule with several slots, keeps unchanged slots and keeps removed ones as history', async () => {
    const { owner, token, s6A } = await school();
    const saved = await putSlots(token, s6A.id, [BATCH[2], BATCH[0], BATCH[1]]);
    expect(saved.status).toBe(200);
    expect(times(saved.body.payload.slots)).toEqual(['1 16:00-17:30', '3 18:00-19:00', '6 16:00-17:30']);
    const [mon, wed] = saved.body.payload.slots;

    // Move Wednesday to 18:30; Monday and Saturday keep their rows.
    const moved = await putSlots(token, s6A.id, [BATCH[0], { day_of_week: WED, start_time: '18:30', end_time: '19:30' }, BATCH[2]]);
    expect(times(moved.body.payload.slots)).toEqual(['1 16:00-17:30', '3 18:30-19:30', '6 16:00-17:30']);
    expect(moved.body.payload.slots[0].id).toBe(mon.id);
    expect(moved.body.payload.slots[1].id).not.toBe(wed.id);
    const old = await t.dataSource.getRepository(RoutineSlotEntity).findOneByOrFail({ id: wed.id });
    expect(old).toMatchObject({ is_active: ActiveStatusEnum.INACTIVE, removed_by: owner.id, start_time: '18:00:00' });

    // An empty list clears the schedule.
    expect((await putSlots(token, s6A.id, [])).body.payload.slots).toEqual([]);
    expect(await t.dataSource.getRepository(RoutineSlotEntity).countBy({ section_id: s6A.id })).toBe(4);
  });

  it('refuses impossible and overlapping slots, and allows back-to-back ones', async () => {
    const { token, s6A } = await school();
    const bad: unknown[][] = [
      [{ day_of_week: 8, start_time: '16:00', end_time: '17:00' }],
      [{ day_of_week: 0, start_time: '16:00', end_time: '17:00' }],
      [{ day_of_week: SAT, start_time: '4pm', end_time: '17:00' }],
      [{ day_of_week: SAT, start_time: '24:00', end_time: '17:00' }],
      [{ day_of_week: SAT, start_time: '16:00' }],
      Array.from({ length: 31 }, (_, i) => ({ day_of_week: 1 + (i % 7), start_time: `0${i % 4}:00`.slice(-5), end_time: '23:00' })),
    ];
    for (const slots of bad) expect((await putSlots(token, s6A.id, slots)).status).toBe(400);

    const reversed = await putSlots(token, s6A.id, [BATCH[0], { day_of_week: SAT, start_time: '17:00', end_time: '16:00' }]);
    expect(reversed.status).toBe(400);
    expect(reversed.body).toMatchObject({ code: 'SCHEDULE_TIME_INVALID', details: { slot: 1 } });
    const empty = await putSlots(token, s6A.id, [{ day_of_week: SAT, start_time: '16:00', end_time: '16:00' }]);
    expect(empty.body.code).toBe('SCHEDULE_TIME_INVALID');

    const overlap = await putSlots(token, s6A.id, [BATCH[2], { day_of_week: SAT, start_time: '17:00', end_time: '18:00' }]);
    expect(overlap.status).toBe(400);
    expect(overlap.body).toMatchObject({ code: 'SCHEDULE_OVERLAP', details: { slot: 1 } });
    expect((await rowOf(token, s6A.id)).slots).toEqual([]);

    const backToBack = await putSlots(token, s6A.id, [BATCH[2], { day_of_week: SAT, start_time: '17:30', end_time: '18:30' }]);
    expect(backToBack.status).toBe(200);
    expect(backToBack.body.payload.slots).toHaveLength(2);
  });

  it('lets a slot name a teacher, who cannot be in two overlapping slots of the session', async () => {
    const { organization, token, s6A, s6B, s7A } = await school();
    const { user: teacher } = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const { user: student } = await memberOf(organization, OrganizationMemberRoleEnum.STUDENT);
    const outsider = await make.teacher({ personal_teacher_enabled: false });

    const withTeacher = await putSlots(token, s6A.id, [{ ...BATCH[2], teacher_id: teacher.id }]);
    expect(withTeacher.status).toBe(200);
    expect(withTeacher.body.payload.slots[0].teacher).toEqual({ id: teacher.id, full_name: teacher.full_name });

    for (const person of [student, outsider]) {
      const refused = await putSlots(token, s6B.id, [{ ...BATCH[0], teacher_id: person.id }]);
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('ATTENDANCE_SETUP_TEACHER_INVALID');
    }

    const clash = await putSlots(token, s6B.id, [BATCH[0], { day_of_week: SAT, start_time: '17:00', end_time: '18:00', teacher_id: teacher.id }]);
    expect(clash.status).toBe(409);
    expect(clash.body).toMatchObject({ code: 'SCHEDULE_TEACHER_CLASH', details: { slot: 1, section: { name: 'A', class_name: 'Class 6' } } });

    // Right after the other class is fine, and so is the same time without that teacher.
    expect((await putSlots(token, s6B.id, [{ day_of_week: SAT, start_time: '17:30', end_time: '18:30', teacher_id: teacher.id }])).status).toBe(200);
    expect((await putSlots(token, s7A.id, [BATCH[2]])).status).toBe(200);
    // Once the clashing slot is removed, the time is free again.
    await putSlots(token, s6A.id, []);
    expect((await putSlots(token, s7A.id, [{ ...BATCH[2], teacher_id: teacher.id }])).status).toBe(200);
  });

  it("changes a section's type, mode, grace period and branch", async () => {
    const { token, s6A } = await school();
    const branch = (await call<{ id: string }>('POST', '/attendance/branches', token, { name: 'Farmgate' })).body.payload;
    const main = (await grid(token)).body.payload.main_branch_id;

    const saved = await patchSection(token, s6A.id, { class_type: 'ONLINE', mode: 'PAPER_REGISTER', grace_minutes: 5, branch_id: branch.id });
    expect(saved.status).toBe(200);
    expect(saved.body.payload).toMatchObject({ class_type: 'ONLINE', mode: 'PAPER_REGISTER', grace_minutes: 5, branch_id: branch.id });
    expect((await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ id: s6A.id })).branch_id).toBe(branch.id);

    // Back to the organisation's grace period and the main branch (stored as no branch).
    const reset = await patchSection(token, s6A.id, { grace_minutes: null, branch_id: main });
    expect(reset.body.payload).toMatchObject({ class_type: 'ONLINE', grace_minutes: null, branch_id: main });
    expect((await t.dataSource.getRepository(SectionEntity).findOneByOrFail({ id: s6A.id })).branch_id).toBeNull();
    expect((await patchSection(token, s6A.id, { grace_minutes: 0 })).body.payload.grace_minutes).toBe(0);

    for (const body of [{ grace_minutes: 61 }, { grace_minutes: -1 }, { class_type: 'HYBRID' }, { mode: 'ROLL_CALL' }, { branch_id: 'x' }]) {
      expect([body, (await patchSection(token, s6A.id, body)).status]).toEqual([body, 400]);
    }
    // A removed branch, or another organisation's, cannot be chosen.
    await call('DELETE', `/attendance/branches/${branch.id}`, token);
    const other = await school();
    const otherBranch = (await call<{ id: string }>('POST', '/attendance/branches', other.token, { name: 'Badda' })).body.payload;
    for (const id of [branch.id, otherBranch.id]) {
      const refused = await patchSection(token, s6A.id, { branch_id: id });
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('ATTENDANCE_BRANCH_NOT_FOUND');
    }
  });

  it("copies another section's schedule without its teachers, only within the session", async () => {
    const { organization, token, s6A, s6B } = await school();
    const { user: teacher } = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    await putSlots(token, s6A.id, [{ ...BATCH[0], teacher_id: teacher.id }, BATCH[1], BATCH[2]]);

    const copied = await copy(token, s6B.id, s6A.id);
    expect(copied.status).toBe(200);
    expect(times(copied.body.payload.slots)).toEqual(times((await rowOf(token, s6A.id)).slots));
    expect(copied.body.payload.slots.every((slot) => slot.teacher_id === null)).toBe(true);

    const self = await copy(token, s6A.id, s6A.id);
    expect(self.body.code).toBe('ATTENDANCE_SETUP_SOURCE_INVALID');
    // A section of another session.
    const session = await t.dataSource.getRepository(AcademicSessionEntity).save({
      organization_id: organization.id,
      name: 'Next year',
      start_date: '2099-01-01',
      end_date: '2099-12-31',
      status: AcademicSessionStatusEnum.ACTIVE,
      is_default: false,
    } as DeepPartial<AcademicSessionEntity>);
    const later = await t.dataSource.getRepository(SectionEntity).save({
      organization_id: organization.id,
      class_id: s6A.class_id,
      session_id: session.id,
      name: 'A',
    } as DeepPartial<SectionEntity>);
    expect((await copy(token, later.id, s6A.id)).body.code).toBe('ATTENDANCE_SETUP_SOURCE_INVALID');
  });

  it('applies a schedule to every other section of a class or a shift, with a preview first', async () => {
    const { organization, token, class6, s6A, s6B, s7A } = await school();
    const { user: teacher } = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    await putSlots(token, s6A.id, BATCH);
    await patchSection(token, s6A.id, { class_type: 'ONLINE', grace_minutes: 15 });
    await putSlots(token, s6B.id, [{ day_of_week: 2, start_time: '09:00', end_time: '10:00', teacher_id: teacher.id }]);

    const preview = await apply(token, { from_section_id: s6A.id, class_id: class6, dry_run: true });
    expect(preview.status).toBe(200);
    expect(preview.body.payload).toEqual({
      dry_run: true,
      sections: [{ id: s6B.id, name: 'B', class_name: 'Class 6', slots_before: 1, teachers_dropped: 1 }],
    });
    expect((await rowOf(token, s6B.id)).slots).toHaveLength(1);

    expect((await apply(token, { from_section_id: s6A.id, class_id: class6 })).status).toBe(200);
    const b = await rowOf(token, s6B.id);
    expect(times(b.slots)).toEqual(times(BATCH.slice().sort((x, y) => x.day_of_week - y.day_of_week)));
    expect(b).toMatchObject({ class_type: 'IN_PERSON', grace_minutes: null });
    expect((await rowOf(token, s7A.id)).slots).toEqual([]);

    // The morning shift: Class 7 A only (6 A is the source, 6 B is the day shift); settings too, never the branch.
    const branch = (await call<{ id: string }>('POST', '/attendance/branches', token, { name: 'Farmgate' })).body.payload;
    await patchSection(token, s6A.id, { branch_id: branch.id });
    const shift = await apply(token, { from_section_id: s6A.id, shift: 'MORNING', include_settings: true });
    expect(shift.body.payload.sections.map((s) => s.id)).toEqual([s7A.id]);
    const sevenA = await rowOf(token, s7A.id);
    expect(sevenA).toMatchObject({ class_type: 'ONLINE', grace_minutes: 15, mode: 'SELF_CHECKIN' });
    expect(sevenA.branch_id).not.toBe(branch.id);
    expect(times(sevenA.slots)).toHaveLength(3);

    for (const body of [{ from_section_id: s6A.id }, { from_section_id: s6A.id, class_id: class6, shift: 'DAY' }]) {
      const refused = await apply(token, body);
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('ATTENDANCE_SETUP_TARGET_INVALID');
    }
  });

  it('lets owners, admins and assistants set up every section and a teacher only the sections they teach', async () => {
    const { organization, token, class6, s6A, s6B, s7A } = await school();
    const assistant = await memberOf(organization, OrganizationMemberRoleEnum.ASSISTANT);
    const subjectTeacher = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const classTeacher = await memberOf(organization, OrganizationMemberRoleEnum.TEACHER);
    const student = await memberOf(organization, OrganizationMemberRoleEnum.STUDENT);

    // A subject class of 6 A taught by one teacher; the other is class teacher of 7 A.
    const math = await t.dataSource
      .getRepository(SubjectEntity)
      .save({ name: 'Math', code: 'MATH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    expect((await call('POST', `/classes/${class6}/subjects`, token, { subject_id: math.id })).status).toBe(201);
    const [offering] = (await call<{ id: string }[]>('GET', `/sections/${s6A.id}/offerings`, token)).body.payload;
    expect((await call('PUT', `/offerings/${offering.id}/teachers`, token, { teacher_ids: [subjectTeacher.user.id] })).status).toBe(200);
    expect((await call('PATCH', `/sections/${s7A.id}`, token, { class_teacher_id: classTeacher.user.id })).status).toBe(200);

    expect((await putSlots(assistant.token, s6B.id, [BATCH[0]])).status).toBe(200);
    expect((await patchSection(assistant.token, s6B.id, { mode: 'PAPER_REGISTER' })).status).toBe(200);

    const teacherGrid = (await grid(subjectTeacher.token)).body.payload;
    expect(teacherGrid.can_manage).toBe(false);
    expect(teacherGrid.sections.filter((row) => row.can_edit).map((row) => row.id)).toEqual([s6A.id]);
    expect((await putSlots(subjectTeacher.token, s6A.id, [BATCH[2]])).status).toBe(200);
    expect((await patchSection(subjectTeacher.token, s6A.id, { grace_minutes: 5, class_type: 'ONLINE' })).status).toBe(200);
    expect((await copy(subjectTeacher.token, s6A.id, s6B.id)).status).toBe(200);
    expect((await putSlots(subjectTeacher.token, s6B.id, [BATCH[2]])).status).toBe(403);
    expect((await patchSection(subjectTeacher.token, s7A.id, { grace_minutes: 5 })).status).toBe(403);
    // Teachers neither move sections between branches nor apply a schedule to many sections.
    const main = teacherGrid.main_branch_id;
    expect((await patchSection(subjectTeacher.token, s6A.id, { branch_id: main })).status).toBe(403);
    expect((await apply(subjectTeacher.token, { from_section_id: s6A.id, class_id: class6 })).status).toBe(403);

    expect((await putSlots(classTeacher.token, s7A.id, [BATCH[1]])).status).toBe(200);
    expect((await putSlots(classTeacher.token, s6A.id, [BATCH[1]])).status).toBe(403);

    expect((await grid(student.token)).status).toBe(403);
    expect((await putSlots(student.token, s6A.id, [BATCH[0]])).status).toBe(403);
  });

  it('keeps a closed session read-only', async () => {
    const { organization, token, class6, s6A, s6B } = await school();
    await putSlots(token, s6A.id, [BATCH[0]]);
    await t.dataSource
      .getRepository(AcademicSessionEntity)
      .update({ organization_id: organization.id }, { status: AcademicSessionStatusEnum.CLOSED });
    const view = (await grid(token)).body.payload;
    expect(view.can_manage).toBe(false);
    expect(view.sections.every((row) => !row.can_edit)).toBe(true);
    expect((await putSlots(token, s6A.id, [])).status).toBe(400);
    expect((await patchSection(token, s6A.id, { mode: 'PAPER_REGISTER' })).status).toBe(400);
    expect((await copy(token, s6B.id, s6A.id)).status).toBe(400);
    expect((await apply(token, { from_section_id: s6A.id, class_id: class6 })).status).toBe(400);
    expect((await rowOf(token, s6A.id)).slots).toHaveLength(1);
  });

  it('refuses the setup with FEATURE_NOT_IN_PLAN while the plan has no attendance', async () => {
    const { token, s6A } = await school({ enabled: false });
    for (const response of [await grid(token), await putSlots(token, s6A.id, [BATCH[0]]), await patchSection(token, s6A.id, { mode: 'PAPER_REGISTER' })]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'FEATURE_NOT_IN_PLAN', feature: 'attendance' });
    }
  });

  it("never reads or changes another organisation's sections", async () => {
    const a = await school();
    const b = await school();
    await putSlots(a.token, a.s6A.id, [BATCH[0]]);

    expect((await grid(b.token)).body.payload.sections.map((row) => row.id)).not.toContain(a.s6A.id);
    expect((await putSlots(b.token, a.s6A.id, [])).status).toBe(404);
    expect((await patchSection(b.token, a.s6A.id, { mode: 'PAPER_REGISTER' })).status).toBe(404);
    expect((await copy(b.token, b.s6A.id, a.s6A.id)).status).toBe(404);
    expect((await copy(b.token, a.s6B.id, b.s6A.id)).status).toBe(404);
    expect((await apply(b.token, { from_section_id: a.s6A.id, class_id: a.class6 })).status).toBe(404);
    // B's teacher cannot be placed on A's slots.
    const { user: bTeacher } = await memberOf(b.organization, OrganizationMemberRoleEnum.TEACHER);
    expect((await putSlots(a.token, a.s6B.id, [{ ...BATCH[0], teacher_id: bTeacher.id }])).body.code).toBe('ATTENDANCE_SETUP_TEACHER_INVALID');
    // A's owner pointing at B's workspace is not a member there.
    expect((await grid(orgSession(a.owner, b.organization))).status).toBe(403);

    const aRow = await rowOf(a.token, a.s6A.id);
    expect(aRow).toMatchObject({ mode: 'SELF_CHECKIN' });
    expect(aRow.slots).toHaveLength(1);
  });

  it('records setup and schedule changes in the audit log, with where a schedule came from', async () => {
    const { owner, organization, token, class6, s6A, s6B } = await school();
    await patchSection(token, s6A.id, { mode: 'PAPER_REGISTER' });
    await patchSection(token, s6A.id, { mode: 'PAPER_REGISTER' }); // no change, no row
    await putSlots(token, s6A.id, [BATCH[0]]);
    await putSlots(token, s6A.id, [BATCH[0]]); // no change, no row
    await copy(token, s6B.id, s6A.id);
    await putSlots(token, s6B.id, []);
    await apply(token, { from_section_id: s6A.id, class_id: class6 });
    await audit.flush();
    const rows = await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: organization.id, entity_type: 'section' } });
    const summary = rows.map((row) => `${row.action} ${row.entity_id === s6A.id ? '6A' : '6B'} ${(row.after as { source?: string })?.source ?? ''}`.trim()).sort();
    expect(summary).toEqual([
      'schedule.update 6A grid',
      'schedule.update 6B apply',
      'schedule.update 6B copy',
      'schedule.update 6B grid',
      'section_attendance.update 6A',
    ]);
    expect(rows.every((row) => row.actor_id === owner.id)).toBe(true);
    const settings = rows.find((row) => row.action === 'section_attendance.update');
    expect(settings).toMatchObject({ before: { mode: 'SELF_CHECKIN' }, after: { mode: 'PAPER_REGISTER' } });
    const first = rows.find((row) => row.action === 'schedule.update' && (row.after as { source: string }).source === 'grid' && row.entity_id === s6A.id);
    expect(first).toMatchObject({ before: { slots: [] }, after: { slots: [{ day_of_week: MON, start_time: '16:00', end_time: '17:30', teacher_id: null }] } });
    const copied = rows.find((row) => (row.after as { source: string }).source === 'copy');
    expect(copied?.after).toMatchObject({ from_section_id: s6A.id });
  });
});
