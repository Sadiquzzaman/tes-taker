import { DeepPartial } from 'typeorm';
import { RemindersService } from '../../src/calendar-feed/reminders.service';
import { ClassEntity } from '../../src/classes/entities/class.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Offset = { minutes: number; channel: 'IN_APP' | 'SMS' };
type Settings = { defaults: Record<string, Offset[]>; mine: Record<string, { offsets: Offset[]; own: boolean }>; can_manage: boolean };

// Class 6 A meets Saturdays 10:00–10:45 in Dhaka: Saturday 14 November 2026 at 04:00 UTC.
const CLASS_START = Date.parse('2026-11-14T04:00:00.000Z');
const minutesBefore = (start: number, minutes: number) => new Date(start - minutes * 60_000);

/**
 * Reminders before classes, exams and events (P5-05 part 4, CAL-05): the organisation's defaults
 * and each person's own, and the job that sends each reminder once, in the app or by SMS.
 */
describe('reminders API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;
  let reminders: RemindersService;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const sent = async (organizationId: string, channel?: string) =>
    (
      await t.dataSource.getRepository(NotificationOutboxEntity).find({ where: { organization_id: organizationId, event_type: 'calendar.reminder', ...(channel ? { channel: channel as never } : {}) } })
    )
      .map((row) => row.recipient_id)
      .sort();

  /** Class 6 A on Saturdays 10:00 with Rina; Mitu and Rafi study there; the calendar feature is on. */
  const school = async ({ calendarOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false, full_name: 'Owner' });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    for (const key of calendarOn ? ['calendar', 'attendance'] : ['attendance']) {
      expect((await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/${key}`, { body: { value: true, reason: 'P5-05 test' }, token: t.tokenFor(admin) })).status).toBe(200);
    }
    const math = await t.dataSource.getRepository(SubjectEntity).save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    const classEntity = await t.dataSource.getRepository(ClassEntity).findOneByOrFail({ id: classId });
    await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: math.id });
    const students: UserEntity[] = [];
    for (const name of ['Mitu', 'Rafi']) {
      const student = await make.student({ full_name: name });
      await make.member(organization, student, OrganizationMemberRoleEnum.STUDENT);
      const enrolment = await make.enrol(classEntity, student);
      await t.dataSource.query(`UPDATE enrolments SET joined_at = '2026-10-01T00:00:00Z' WHERE id = $1`, [enrolment.id]);
      students.push(student);
    }
    const [section] = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const rina = await make.teacher({ full_name: 'Rina' });
    await make.member(organization, rina, OrganizationMemberRoleEnum.TEACHER);
    const slot = await call('PUT', `/attendance/setup/sections/${section.id}/slots`, ownerToken, { slots: [{ day_of_week: 6, start_time: '10:00', end_time: '10:45', teacher_id: rina.id }] });
    expect(slot.status).toBe(200);
    await t.dataSource.query(`UPDATE routine_slots SET created_at = '2026-10-01 00:00:00' WHERE section_id = $1`, [section.id]);
    const [mitu, rafi] = students;
    return {
      organization,
      owner,
      ownerToken,
      rina,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      rafi,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      classId,
      sectionId: section.id,
    };
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    admin = await make.user(RolesEnum.SUPER_ADMIN);
    reminders = t.app.get(RemindersService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    await t.close();
  });

  it("keeps the organisation's defaults and each person's own reminders", async () => {
    const s = await school();
    const start = (await call<Settings>('GET', '/reminders', s.mituToken)).body.payload;
    expect(start.defaults).toEqual({ CLASS: [{ minutes: 30, channel: 'IN_APP' }], EXAM: [{ minutes: 60, channel: 'IN_APP' }], EVENT: [{ minutes: 60, channel: 'IN_APP' }] });
    expect(start.mine.CLASS).toEqual({ offsets: [{ minutes: 30, channel: 'IN_APP' }], own: false });
    expect(start.can_manage).toBe(false);

    const saved = await call<Settings>('PUT', '/reminders/defaults/CLASS', s.ownerToken, { offsets: [{ minutes: 15, channel: 'SMS' }, { minutes: 120, channel: 'IN_APP' }] });
    expect(saved.status).toBe(200);
    expect(saved.body.payload.defaults.CLASS).toEqual([{ minutes: 120, channel: 'IN_APP' }, { minutes: 15, channel: 'SMS' }]);
    expect((await call('PUT', '/reminders/defaults/CLASS', s.rinaToken, { offsets: [] })).status).toBe(403);

    // A student switches exam reminders off and sets their own class reminders, then goes back.
    expect((await call<Settings>('PUT', '/reminders/mine/EXAM', s.mituToken, { offsets: [] })).body.payload.mine.EXAM).toEqual({ offsets: [], own: true });
    expect((await call<Settings>('PUT', '/reminders/mine/CLASS', s.mituToken, { offsets: [{ minutes: 60, channel: 'IN_APP' }] })).body.payload.mine.CLASS.own).toBe(true);
    const reset = await call<Settings>('DELETE', '/reminders/mine/CLASS', s.mituToken);
    expect(reset.body.payload.mine.CLASS).toEqual({ offsets: [{ minutes: 120, channel: 'IN_APP' }, { minutes: 15, channel: 'SMS' }], own: false });

    for (const offsets of [
      Array.from({ length: 6 }, (_, i) => ({ minutes: 10 + i, channel: 'IN_APP' })),
      [{ minutes: 3, channel: 'IN_APP' }],
      [{ minutes: 30, channel: 'IN_APP' }, { minutes: 30, channel: 'SMS' }],
      [{ minutes: 30, channel: 'EMAIL' }],
    ]) {
      expect((await call('PUT', '/reminders/mine/CLASS', s.mituToken, { offsets })).status).toBe(400);
    }
    expect((await call('PUT', '/reminders/mine/HOMEWORK', s.mituToken, { offsets: [] })).status).toBe(400);
  });

  it("sends each class reminder once at its time, to the section's students and teacher, by each person's own choice", async () => {
    const s = await school();
    // Rafi wants an SMS an hour before instead of the default.
    await call('PUT', '/reminders/mine/CLASS', t.tokenFor(s.rafi, { session_mode: 'organization', context_type: 'organization', organization_id: s.organization.id, member_role: OrganizationMemberRoleEnum.STUDENT }), {
      offsets: [{ minutes: 60, channel: 'SMS' }],
    });

    await reminders.sweep(minutesBefore(CLASS_START, 61));
    expect(await sent(s.organization.id)).toEqual([]);
    await reminders.sweep(minutesBefore(CLASS_START, 60));
    expect(await sent(s.organization.id, 'SMS')).toEqual([s.rafi.id]);
    await reminders.sweep(minutesBefore(CLASS_START, 30));
    expect(await sent(s.organization.id, 'IN_APP')).toEqual([s.mitu.id, s.rina.id].sort());
    // Run again (or a minute later): nobody is told twice.
    await reminders.sweep(minutesBefore(CLASS_START, 29));
    await reminders.sweep(minutesBefore(CLASS_START, 30));
    expect(await sent(s.organization.id)).toEqual([s.mitu.id, s.rafi.id, s.rina.id].sort());
  });

  it('reminds attendees of events and students of exams, never of a cancelled class, and only with the calendar feature', async () => {
    const s = await school();
    // The class next week is cancelled.
    expect((await call('POST', `/attendance/sessions/${(await t.dataSource.query(`SELECT id FROM routine_slots WHERE section_id = $1`, [s.sectionId]))[0].id}/2026-11-14/cancel`, s.ownerToken, {})).status).toBe(200);
    const eventStart = Date.parse('2026-11-15T05:00:00.000Z');
    const event = await call<{ id: string }>('POST', '/events', s.ownerToken, { type: 'MEETING', title: 'Parents', starts_at: new Date(eventStart).toISOString(), ends_at: new Date(eventStart + 3_600_000).toISOString(), user_ids: [s.rina.id] });
    expect(event.status).toBe(201);
    const examStart = Date.parse('2026-11-16T04:00:00.000Z');
    await make.openExam(s.owner, { organization_id: s.organization.id, class_id: s.classId, test_audience: 'selected_class' as never, test_name: 'Unit test', exam_start_time: new Date(examStart), exam_end_time: new Date(examStart + 3_600_000) });

    await reminders.sweep(minutesBefore(CLASS_START, 30));
    expect(await sent(s.organization.id)).toEqual([]);
    await reminders.sweep(minutesBefore(eventStart, 60));
    expect(await sent(s.organization.id)).toEqual([s.rina.id]);
    await reminders.sweep(minutesBefore(examStart, 60));
    expect(await sent(s.organization.id)).toEqual([s.mitu.id, s.rafi.id, s.rina.id].sort());

    const off = await school({ calendarOn: false });
    await reminders.sweep(minutesBefore(CLASS_START + 7 * 24 * 3_600_000, 30));
    expect(await sent(off.organization.id)).toEqual([]);
    expect((await call('GET', '/reminders', off.ownerToken)).status).toBe(403);
  });
});
