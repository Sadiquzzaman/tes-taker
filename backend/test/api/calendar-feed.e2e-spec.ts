import { DeepPartial } from 'typeorm';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Item = {
  kind: string;
  id: string;
  date?: string;
  starts_at?: string;
  title: string | null;
  subject?: string | null;
  room?: string | null;
  teacher?: string | null;
  role?: string;
  reason?: string;
  sections?: string[];
  handed_in?: boolean | null;
  workspace?: { key: string; label: string };
};
type Feed = { from: string; to: string; time_zone: string; items: Item[]; workspaces?: { key: string; label: string }[] };

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
      sectionId: section.id as string,
      offering,
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

    // Rina teaches the class; she did not make the exam. The owner made it.
    const teacher = (await feed(s.rinaToken)).body.payload.items;
    expect(teacher.find((item) => item.kind === 'CLASS')).toMatchObject({ role: 'TEACHER', subject: 'Math' });
    expect(teacher.some((item) => item.kind === 'EXAM')).toBe(false);
    expect((await feed(s.ownerToken)).body.payload.items.some((item) => item.kind === 'EXAM' && item.id === exam.id)).toBe(true);

    const tooLong = await feed(s.mituToken, '2026-12-01', '2027-02-15');
    expect([tooLong.status, tooLong.body.code]).toEqual([400, 'CALENDAR_RANGE_INVALID']);
  });

  it("gives each person one calendar across all their workspaces, with homework due, and only their own", async () => {
    const s = await school();
    expect((await override(s.organization.id, 'homework', true)).status).toBe(200);
    const homework = await call<{ id: string }>('POST', '/homework', s.rinaToken, {
      title: 'Chapter 3',
      instructions: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Do 1 to 10.' }] }] },
      submission_type: 'FILE',
      total_marks: 10,
      due_at: '2026-12-09T12:00:00.000Z',
      offering_ids: [s.offering],
    });
    expect(homework.status).toBe(201);
    expect((await call('POST', `/homework/${homework.body.payload.id}/publish`, s.rinaToken, {})).status).toBe(200);
    // Rina's event for her section: hers, not the owner's.
    const lesson = await call<{ id: string }>('POST', '/events', s.rinaToken, {
      type: 'ACTIVITY',
      title: 'Science fair practice',
      starts_at: '2026-12-07T08:00:00.000Z',
      ends_at: '2026-12-07T09:00:00.000Z',
      section_ids: [s.sectionId],
    });
    expect(lesson.status).toBe(201);

    // Rina also teaches at a second school with the calendar, and a third without it.
    const secondOwner = await make.teacher({ personal_teacher_enabled: false });
    const second = await make.organization(secondOwner, { name: 'Second School' });
    expect((await override(second.id, 'calendar', true)).status).toBe(200);
    await make.member(second, s.rina, OrganizationMemberRoleEnum.TEACHER);
    const secondToken = t.tokenFor(secondOwner, { session_mode: 'organization', context_type: 'organization', organization_id: second.id, member_role: OrganizationMemberRoleEnum.OWNER });
    const meeting = await call<{ id: string }>('POST', '/events', secondToken, {
      type: 'MEETING',
      title: 'Staff meeting',
      starts_at: '2026-12-10T10:00:00.000Z',
      ends_at: '2026-12-10T11:00:00.000Z',
      whole_org: true,
    });
    expect(meeting.status).toBe(201);
    const third = await make.organization(await make.teacher({ personal_teacher_enabled: false }), { name: 'Third School' });
    expect((await override(third.id, 'calendar', false)).status).toBe(200);
    await make.member(third, s.rina, OrganizationMemberRoleEnum.TEACHER);

    // No workspace needs to be chosen.
    const mine = (who: UserEntity) => call<Feed>('GET', `/calendar/me?from=${FROM}&to=${TO}`, t.tokenFor(who));
    const rina = await mine(s.rina);
    expect(rina.status).toBe(200);
    expect(rina.body.payload.workspaces?.map((w) => w.label).sort()).toEqual([s.organization.name, 'Second School'].sort());
    const items = rina.body.payload.items;
    expect(items.find((item) => item.kind === 'CLASS')).toMatchObject({ subject: 'Math', workspace: { label: s.organization.name } });
    expect(items.find((item) => item.kind === 'EVENT' && item.id === meeting.body.payload.id)).toMatchObject({ title: 'Staff meeting', workspace: { label: 'Second School' } });
    expect(items.find((item) => item.kind === 'HOMEWORK')).toMatchObject({
      id: homework.body.payload.id,
      title: 'Chapter 3',
      subject: 'Math',
      sections: ['Class 6 A'],
      handed_in: null,
      starts_at: '2026-12-09T12:00:00.000Z',
    });
    // Sorted by time across workspaces: the meeting (Thursday) is last.
    expect(items.filter((item) => item.kind !== 'HOLIDAY').map((item) => item.title)).toEqual(['Class 6 A', 'Science fair practice', 'Chapter 3', 'Staff meeting']);

    // The student sees the homework as not handed in yet.
    expect((await mine(s.mitu)).body.payload.items.find((item) => item.kind === 'HOMEWORK')).toMatchObject({ handed_in: false });
    // The owner doesn't teach the subject or attend Rina's event: neither is on their own calendar,
    // though the events list still shows them every event.
    const owner = (await mine(s.owner)).body.payload.items;
    expect(owner.some((item) => item.kind === 'HOMEWORK' || item.id === lesson.body.payload.id)).toBe(false);
    const events = await call<{ id: string }[]>('GET', `/events?from=${FROM}&to=${TO}`, s.ownerToken);
    expect(events.body.payload.some((event) => event.id === lesson.body.payload.id)).toBe(true);

    const tooLong = await call('GET', '/calendar/me?from=2026-12-01&to=2027-02-15', t.tokenFor(s.rina));
    expect(tooLong.status).toBe(400);
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
  it("gives one personal link for all of a person's workspaces, apart from each workspace's own link", async () => {
    const s = await school();
    const secondOwner = await make.teacher({ personal_teacher_enabled: false });
    const second = await make.organization(secondOwner, { name: 'Second School' });
    expect((await override(second.id, 'calendar', true)).status).toBe(200);
    await make.member(second, s.rina, OrganizationMemberRoleEnum.TEACHER);
    const secondToken = t.tokenFor(secondOwner, { session_mode: 'organization', context_type: 'organization', organization_id: second.id, member_role: OrganizationMemberRoleEnum.OWNER });
    const meeting = await call<{ id: string }>('POST', '/events', secondToken, { type: 'MEETING', title: 'Staff meeting', starts_at: '2026-12-10T10:00:00.000Z', ends_at: '2026-12-10T11:00:00.000Z', whole_org: true });
    expect(meeting.status).toBe(201);

    // No workspace needs to be chosen.
    const plain = t.tokenFor(s.rina);
    expect((await call<{ active: boolean }>('GET', '/calendar/me/ical-link', plain)).body.payload.active).toBe(false);
    const made = await call<{ path: string }>('POST', '/calendar/me/ical-link', plain);
    expect(made.status).toBe(201);
    expect((await call<{ active: boolean }>('GET', '/calendar/me/ical-link', plain)).body.payload.active).toBe(true);
    // The first school's own link is a different one, still off.
    expect((await call<{ active: boolean }>('GET', '/calendar/ical-link', s.rinaToken)).body.payload.active).toBe(false);

    const text = (await t.api.request<string>('GET', made.body.payload.path)).body;
    expect(text).toContain(`UID:class-${s.slotId}-2026-12-05@instructor`);
    expect(text).toContain(`UID:event-${meeting.body.payload.id}@instructor`);

    // Without the calendar in any workspace the link shows nothing; turned off, it stops.
    await override(s.organization.id, 'calendar', false);
    await override(second.id, 'calendar', false);
    expect((await t.api.request('GET', made.body.payload.path)).status).toBe(404);
    await override(s.organization.id, 'calendar', true);
    expect((await t.api.request('GET', made.body.payload.path)).status).toBe(200);
    expect((await call('DELETE', '/calendar/me/ical-link', plain)).status).toBe(200);
    expect((await t.api.request('GET', made.body.payload.path)).status).toBe(404);
  });
});
