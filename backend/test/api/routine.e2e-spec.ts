import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RoutineSlotEntity } from '../../src/calendar/entities/routine-slot.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string; details?: Record<string, unknown> };
type Clash = { kind: 'TEACHER' | 'ROOM'; slot_id: string; section: { id: string; name: string; class_name: string | null } };
type Slot = {
  id: string;
  section: { id: string; name: string; class_name: string | null };
  subject: { offering_id: string; name: string } | null;
  teacher: { id: string; full_name: string } | null;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  clashes: Clash[];
};
type Routine = {
  session: { id: string };
  can_manage: boolean;
  sections: { id: string; name: string; class_name: string | null }[];
  subject_classes: { offering_id: string; section_id: string; subject: { name: string }; teacher_ids: string[] }[];
  rooms: string[];
  slots: Slot[];
};

/**
 * The weekly class routine (P5-04 part 1, CAL-01, CAL-02): owners, admins and assistants build it
 * slot by slot with a subject, teacher and room; a section never has two classes at once; a teacher
 * or room booked twice is a clash the admin must confirm, and the grid then marks it. Everyone sees
 * their own routine.
 */
describe('routine API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const slots = () => t.dataSource.getRepository(RoutineSlotEntity);

  /** Class 6 with sections A and B, each with Math (Rina teaches A's), a student in A, and the calendar feature. */
  const school = async ({ calendarOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    const features = calendarOn ? ['calendar', 'attendance'] : ['attendance'];
    for (const feature of features) {
      const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/${feature}`, {
        body: { value: true, reason: 'P5-04 test' },
        token: t.tokenFor(admin),
      });
      expect(enabled.status).toBe(200);
    }
    const math = await t.dataSource.getRepository(SubjectEntity).save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: math.id });
    const student = await make.student({ full_name: 'Mitu' });
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [student.email] });
    expect((await call('POST', `/classes/${classId}/sections`, ownerToken, { name: 'B', shift: 'DAY' })).status).toBe(201);
    const sections = (await call<{ id: string; name: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const a = sections.find((s) => s.name === 'A')!.id;
    const b = sections.find((s) => s.name === 'B')!.id;
    const mathOf = async (sectionId: string) =>
      (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${sectionId}/offerings`, ownerToken)).body.payload.find((o) => o.subject.id === math.id)!.id;
    const [mathA, mathB] = [await mathOf(a), await mathOf(b)];
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathA}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    return {
      organization,
      ownerToken,
      rina,
      karim,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      student,
      studentToken: token(student, OrganizationMemberRoleEnum.STUDENT),
      a,
      b,
      mathA,
      mathB,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
  });

  afterAll(async () => {
    await t.close();
  });

  it('builds the routine slot by slot and shows each person their own routine', async () => {
    const s = await school();
    const added = await call<Slot>('POST', '/routine/slots', s.ownerToken, {
      section_id: s.a,
      offering_id: s.mathA,
      teacher_id: s.rina.id,
      room: '  Room   201 ',
      day_of_week: 6,
      start_time: '10:00',
      end_time: '10:45',
    });
    expect(added.status).toBe(201);
    expect(added.body.payload).toMatchObject({
      section: { id: s.a, name: 'A', class_name: 'Class 6' },
      subject: { offering_id: s.mathA, name: 'Math' },
      teacher: { id: s.rina.id, full_name: 'Rina' },
      room: 'Room 201',
      day_of_week: 6,
      start_time: '10:00',
      end_time: '10:45',
      clashes: [],
    });

    const routine = await call<Routine>('GET', '/routine', s.ownerToken);
    expect(routine.status).toBe(200);
    expect(routine.body.payload.can_manage).toBe(true);
    expect(routine.body.payload.sections.map((x) => x.name)).toEqual(['A', 'B']);
    expect(routine.body.payload.subject_classes).toEqual(
      expect.arrayContaining([{ offering_id: s.mathA, section_id: s.a, subject: expect.objectContaining({ name: 'Math' }), teacher_ids: [s.rina.id] }]),
    );
    expect(routine.body.payload.rooms).toEqual(['Room 201']);
    expect(routine.body.payload.slots.map((x) => x.id)).toEqual([added.body.payload.id]);

    // Teachers read the routine but can't change it; students only see their own.
    const asTeacher = await call<Routine>('GET', '/routine', s.karimToken);
    expect(asTeacher.status).toBe(200);
    expect(asTeacher.body.payload.can_manage).toBe(false);
    expect((await call('POST', '/routine/slots', s.rinaToken, { section_id: s.b, day_of_week: 1, start_time: '09:00', end_time: '09:45' })).status).toBe(403);
    expect((await call('GET', '/routine', s.studentToken)).status).toBe(403);

    const studentOwn = await call<Slot[]>('GET', '/routine/mine', s.studentToken);
    expect(studentOwn.body.payload.map((x) => x.id)).toEqual([added.body.payload.id]);
    const rinaOwn = await call<Slot[]>('GET', '/routine/mine', s.rinaToken);
    expect(rinaOwn.body.payload.map((x) => x.id)).toEqual([added.body.payload.id]);
    expect((await call<Slot[]>('GET', '/routine/mine', s.karimToken)).body.payload).toEqual([]);
  });

  it('refuses two classes of one section at once, and asks to confirm a teacher or room booked twice, then marks it', async () => {
    const s = await school();
    const first = await call<Slot>('POST', '/routine/slots', s.ownerToken, {
      section_id: s.a,
      teacher_id: s.rina.id,
      room: 'Lab',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:00',
    });
    expect(first.status).toBe(201);

    const sameSection = await call('POST', '/routine/slots', s.ownerToken, { section_id: s.a, day_of_week: 1, start_time: '09:30', end_time: '10:30' });
    expect(sameSection.status).toBe(400);
    expect(sameSection.body.code).toBe('SCHEDULE_OVERLAP');

    // Section B at an overlapping time with the same teacher and the same room (any case).
    const clashing = { section_id: s.b, teacher_id: s.rina.id, room: 'LAB', day_of_week: 1, start_time: '09:45', end_time: '10:30' };
    const refused = await call<null>('POST', '/routine/slots', s.ownerToken, clashing);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('ROUTINE_CLASH');
    expect((refused.body.details as { clashes: Clash[] }).clashes).toEqual([
      expect.objectContaining({ kind: 'TEACHER', slot_id: first.body.payload.id, section: { id: s.a, name: 'A', class_name: 'Class 6' } }),
      expect.objectContaining({ kind: 'ROOM', slot_id: first.body.payload.id }),
    ]);
    expect(await slots().countBy({ section_id: s.b })).toBe(0);

    // Back to back is not a clash.
    expect((await call('POST', '/routine/slots', s.ownerToken, { ...clashing, start_time: '10:00', end_time: '10:45' })).status).toBe(201);

    const saved = await call<Slot>('POST', '/routine/slots', s.ownerToken, { ...clashing, day_of_week: 1, start_time: '09:15', end_time: '09:50', confirm_clashes: true });
    expect(saved.status).toBe(201);
    expect(saved.body.payload.clashes.map((c) => c.kind)).toEqual(['TEACHER', 'ROOM']);
    const grid = (await call<Routine>('GET', '/routine', s.ownerToken)).body.payload;
    expect(grid.slots.find((x) => x.id === first.body.payload.id)!.clashes).toEqual([
      expect.objectContaining({ kind: 'TEACHER', slot_id: saved.body.payload.id }),
      expect.objectContaining({ kind: 'ROOM', slot_id: saved.body.payload.id }),
    ]);

    // Class setup can still save section B's schedule with the confirmed clash in it (only new slots are checked).
    const setup = (await call<{ sections: { id: string; slots: unknown[] }[] }>('GET', '/attendance/setup', s.ownerToken)).body.payload;
    const bSlots = setup.sections.find((x) => x.id === s.b)!.slots;
    expect((await call('PUT', `/attendance/setup/sections/${s.b}/slots`, s.ownerToken, { slots: bSlots })).status).toBe(200);
  });

  it('changes a slot in place, or as a new row when the time moves; removing keeps the row; every change is in the activity log', async () => {
    const s = await school();
    const added = (await call<Slot>('POST', '/routine/slots', s.ownerToken, { section_id: s.a, offering_id: s.mathA, day_of_week: 2, start_time: '11:00', end_time: '11:45' })).body.payload;

    const roomOnly = await call<Slot>('PATCH', `/routine/slots/${added.id}`, s.ownerToken, { room: 'Room 5', teacher_id: s.karim.id });
    expect(roomOnly.status).toBe(200);
    expect(roomOnly.body.payload).toMatchObject({ id: added.id, room: 'Room 5', teacher: { id: s.karim.id }, subject: { offering_id: s.mathA } });

    const moved = await call<Slot>('PATCH', `/routine/slots/${added.id}`, s.ownerToken, { start_time: '12:00', end_time: '12:45' });
    expect(moved.status).toBe(200);
    expect(moved.body.payload.id).not.toBe(added.id);
    expect(moved.body.payload).toMatchObject({ room: 'Room 5', teacher: { id: s.karim.id }, start_time: '12:00', end_time: '12:45' });
    const old = await slots().findOneByOrFail({ id: added.id });
    expect(Number(old.is_active)).toBe(0);
    expect(old.removed_at).not.toBeNull();

    const removed = await call('DELETE', `/routine/slots/${moved.body.payload.id}`, s.ownerToken);
    expect(removed.status).toBe(200);
    expect(Number((await slots().findOneByOrFail({ id: moved.body.payload.id })).is_active)).toBe(0);
    expect((await call<Routine>('GET', '/routine', s.ownerToken)).body.payload.slots).toEqual([]);
    expect((await call('PATCH', `/routine/slots/${moved.body.payload.id}`, s.ownerToken, { room: 'X' })).status).toBe(404);

    await t.app.get(AuditService).flush();
    const actions = (await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id }, order: { created_at: 'ASC' } }))
      .map((row) => row.action)
      .filter((action) => action.startsWith('routine.'));
    expect(actions).toEqual(['routine.add', 'routine.change', 'routine.change', 'routine.remove']);
  });

  it("refuses another section's subject, a non-teacher, bad times, and works only with the calendar feature", async () => {
    const s = await school();
    const wrongSubject = await call('POST', '/routine/slots', s.ownerToken, { section_id: s.a, offering_id: s.mathB, day_of_week: 3, start_time: '09:00', end_time: '09:45' });
    expect(wrongSubject.status).toBe(400);
    expect(wrongSubject.body.code).toBe('ROUTINE_SUBJECT_INVALID');
    const notTeacher = await call('POST', '/routine/slots', s.ownerToken, { section_id: s.a, teacher_id: s.student.id, day_of_week: 3, start_time: '09:00', end_time: '09:45' });
    expect(notTeacher.status).toBe(400);
    expect(notTeacher.body.code).toBe('ROUTINE_TEACHER_INVALID');
    const backwards = await call('POST', '/routine/slots', s.ownerToken, { section_id: s.a, day_of_week: 3, start_time: '10:00', end_time: '09:00' });
    expect(backwards.status).toBe(400);
    expect(backwards.body.code).toBe('SCHEDULE_TIME_INVALID');

    const other = await school();
    // Another organisation's slot is never found.
    const theirs = (await call<Slot>('POST', '/routine/slots', other.ownerToken, { section_id: other.a, day_of_week: 3, start_time: '09:00', end_time: '09:45' })).body.payload;
    expect((await call('DELETE', `/routine/slots/${theirs.id}`, s.ownerToken)).status).toBe(404);
    expect((await call('POST', '/routine/slots', s.ownerToken, { section_id: other.a, day_of_week: 4, start_time: '09:00', end_time: '09:45' })).status).toBe(404);

    const off = await school({ calendarOn: false });
    expect((await call('GET', '/routine', off.ownerToken)).status).toBe(403);
  });
});
