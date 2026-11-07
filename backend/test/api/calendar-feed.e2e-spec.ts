import { DeepPartial } from 'typeorm';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Item = { kind: string; id: string; date?: string; starts_at?: string; title: string | null; subject?: string | null; room?: string | null; teacher?: string | null; role?: string; reason?: string };
type Feed = { from: string; to: string; time_zone: string; items: Item[] };

// Saturday 5 December 2026 to Friday 11 December (Dhaka, UTC+6).
const FROM = '2026-12-05';
const TO = '2026-12-11';

/**
 * The person's calendar (P5-05 part 2, CAL-07): their classes from the routine, events, exams and
 * closed days in one list, and a private iCal subscription link for Google or Apple Calendar.
 */
describe('calendar feed API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const feed = (token: string, from = FROM, to = TO) => call<Feed>('GET', `/calendar/feed?from=${from}&to=${to}`, token);
  const override = (organizationId: string, key: string, value: boolean) =>
    t.api.request('PUT', `/subscriptions/admin/organizations/${organizationId}/overrides/${key}`, { body: { value, reason: 'P5-05 test' }, token: t.tokenFor(admin) });

  /** Class 6 A meets Saturdays 10:00–10:45 for Math with Rina in Room 201; Mitu studies there. */
  const school = async () => {
    const owner = await make.teacher({ personal_teacher_enabled: false, full_name: 'Owner' });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    for (const key of ['calendar', 'attendance']) expect((await override(organization.id, key, true)).status).toBe(200);
    const math = await t.dataSource.getRepository(SubjectEntity).save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: classId });
    await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: math.id });
    const mitu = await make.student({ full_name: 'Mitu' });
    await make.member(organization, mitu, OrganizationMemberRoleEnum.STUDENT);
    const enrolment = await make.enrol(classEntity, mitu);
    await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
    const [section] = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const offering = (await call<{ id: string }[]>('GET', `/sections/${section.id}/offerings`, ownerToken)).body.payload[0].id;
    const rina = await make.teacher({ full_name: 'Rina' });
    await make.member(organization, rina, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${offering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    const slot = await call<{ id: string }>('POST', '/routine/slots', ownerToken, {
      section_id: section.id,
      offering_id: offering,
      teacher_id: rina.id,
      room: 'Room 201',
      day_of_week: 6,
      start_time: '10:00',
      end_time: '10:45',
    });
    expect(slot.status).toBe(201);
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE id = $1`, [slot.body.payload.id]);
    return {
      organization,
      owner,
      ownerToken,
      rina,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      classId,
      slotId: slot.body.payload.id,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it("puts a person's classes, events, exams and holidays in one list", async () => {
    const s = await school();
    expect((await call('POST', '/holidays', s.ownerToken, { date_from: '2026-12-08', name: 'Founders day' })).status).toBe(201);
    const event = await call<{ id: string }>('POST', '/events', s.ownerToken, {
      type: 'ACTIVITY',
      title: 'Sports day',
      starts_at: '2026-12-06T03:00:00.000Z',
      ends_at: '2026-12-06T09:00:00.000Z',
      whole_org: true,
    });
    expect(event.status).toBe(201);
    const exam = await make.openExam(s.owner, {
      organization_id: s.organization.id,
      class_id: s.classId,
      test_name: 'Unit test 1',
      exam_start_time: new Date('2026-12-07T04:00:00.000Z'),
      exam_end_time: new Date('2026-12-07T05:00:00.000Z'),
    });

    const student = await feed(s.mituToken);
    expect(student.status).toBe(200);
    expect(student.body.payload.time_zone).toBe('Asia/Dhaka');
    const items = student.body.payload.items;
    expect(items.find((item) => item.kind === 'CLASS')).toMatchObject({
      id: `${s.slotId}:2026-12-05`,
      date: '2026-12-05',
      starts_at: '2026-12-05T04:00:00.000Z',
      title: 'Class 6 A',
      subject: 'Math',
      room: 'Room 201',
      teacher: 'Rina',
      role: 'STUDENT',
    });
    expect(items.filter((item) => item.kind === 'CLASS')).toHaveLength(1);
    expect(items.find((item) => item.kind === 'EVENT')).toMatchObject({ id: event.body.payload.id, title: 'Sports day' });
    expect(items.find((item) => item.kind === 'EXAM')).toMatchObject({ id: exam.id, title: 'Unit test 1' });
    expect(items.find((item) => item.kind === 'HOLIDAY' && item.reason === 'HOLIDAY')).toMatchObject({ date: '2026-12-08', title: 'Founders day' });
    // Sorted by date: the class (Saturday) comes before the event (Sunday) and the exam (Monday).
    const order = items.filter((item) => item.kind !== 'HOLIDAY').map((item) => item.kind);
    expect(order).toEqual(['CLASS', 'EVENT', 'EXAM']);

    // Rina teaches the class; she did not make the exam. The owner sees every exam.
    const teacher = (await feed(s.rinaToken)).body.payload.items;
    expect(teacher.find((item) => item.kind === 'CLASS')).toMatchObject({ role: 'TEACHER', subject: 'Math' });
    expect(teacher.some((item) => item.kind === 'EXAM')).toBe(false);
    expect((await feed(s.ownerToken)).body.payload.items.some((item) => item.kind === 'EXAM' && item.id === exam.id)).toBe(true);

    const tooLong = await feed(s.mituToken, '2026-12-01', '2027-02-15');
    expect([tooLong.status, tooLong.body.code]).toEqual([400, 'CALENDAR_RANGE_INVALID']);
  });

  it('gives a private subscription link that Google or Apple Calendar can read, and turns it off', async () => {
    const s = await school();
    expect((await call<{ active: boolean }>('GET', '/calendar/ical-link', s.rinaToken)).body.payload.active).toBe(false);
    const made = await call<{ path: string }>('POST', '/calendar/ical-link', s.rinaToken);
    expect(made.status).toBe(201);
    expect(made.body.payload.path).toMatch(/^\/calendar\/ical\/[A-Za-z0-9_-]{43}\.ics$/);
    expect((await call<{ active: boolean }>('GET', '/calendar/ical-link', s.rinaToken)).body.payload.active).toBe(true);

    // No sign-in: the token is the key.
    const ics = await t.api.request<string>('GET', made.body.payload.path);
    expect(ics.status).toBe(200);
    const text = ics.body;
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain(`UID:class-${s.slotId}-2026-12-05@instructor`);
    expect(text).toContain('SUMMARY:Math — Class 6 A');
    expect(text).toContain('LOCATION:Room 201');
    expect(text).toContain('DTSTART:20261205T040000Z');

    // A new link stops the old one; turning it off stops the new one.
    const again = await call<{ path: string }>('POST', '/calendar/ical-link', s.rinaToken);
    expect((await t.api.request('GET', made.body.payload.path)).status).toBe(404);
    expect((await t.api.request('GET', again.body.payload.path)).status).toBe(200);
    // Without the calendar feature the link stops too.
    await override(s.organization.id, 'calendar', false);
    expect((await t.api.request('GET', again.body.payload.path)).status).toBe(404);
    await override(s.organization.id, 'calendar', true);
    expect((await call('DELETE', '/calendar/ical-link', s.rinaToken)).status).toBe(200);
    expect((await t.api.request('GET', again.body.payload.path)).status).toBe(404);
    expect((await t.api.request('GET', '/calendar/ical/not-a-token.ics')).status).toBe(404);
  });
});
