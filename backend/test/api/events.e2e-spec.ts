import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { EventEntity } from '../../src/calendar/entities/event.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Event = {
  id: string;
  type: string;
  title: string;
  starts_at: string;
  ends_at: string;
  place: string | null;
  whole_org: boolean;
  status: string;
  sections: { id: string; name: string; class_name: string | null }[];
  people: { id: string; full_name: string }[];
  created_by: { id: string } | null;
  can_edit: boolean;
};

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const at = (fromNow: number) => new Date(Date.now() + fromNow).toISOString();
const dateOf = (fromNow: number) => new Date(Date.now() + fromNow + 6 * HOUR).toISOString().slice(0, 10);

/**
 * Calendar events (P5-05 part 1, CAL-03, CAL-06): staff add exams, meetings and activities for
 * sections, people or the whole organisation; attendees see them and are told in-app when one is
 * added, and when it changes or is cancelled within 48 hours of its start.
 */
describe('events API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const list = (token: string, from = dateOf(-DAY), to = dateOf(30 * DAY)) => call<Event[]>('GET', `/events?from=${from}&to=${to}`, token);
  const outbox = (organizationId: string, eventType: string) =>
    t.dataSource
      .getRepository(NotificationOutboxEntity)
      .find({ where: { organization_id: organizationId, event_type: eventType } })
      .then((rows) => rows.map((row) => row.recipient_id).sort());

  /** Class 6 with sections A (Mitu) and B (Rafi); Rina teaches Math in A; Karim is another teacher. */
  const school = async ({ calendarOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false, full_name: 'Owner' });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    if (calendarOn) {
      const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/calendar`, {
        body: { value: true, reason: 'P5-05 test' },
        token: t.tokenFor(admin),
      });
      expect(enabled.status).toBe(200);
    }
    const math = await t.dataSource.getRepository(SubjectEntity).save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: math.id });
    expect((await call('POST', `/classes/${classId}/sections`, ownerToken, { name: 'B', shift: 'DAY' })).status).toBe(201);
    const sections = (await call<{ id: string; name: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const a = sections.find((s) => s.name === 'A')!.id;
    const b = sections.find((s) => s.name === 'B')!.id;
    const mitu = await make.student({ full_name: 'Mitu' });
    const rafi = await make.student({ full_name: 'Rafi' });
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [mitu.email, rafi.email] });
    // Move Rafi to section B.
    await t.dataSource.query(`UPDATE enrolments SET section_id = $1 WHERE student_id = $2`, [b, rafi.id]);
    const offerings = (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${a}/offerings`, ownerToken)).body.payload;
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${offerings[0].id}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    return {
      organization,
      owner,
      ownerToken,
      rina,
      karim,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      mitu,
      rafi,
      mituToken: token(mitu, OrganizationMemberRoleEnum.STUDENT),
      rafiToken: token(rafi, OrganizationMemberRoleEnum.STUDENT),
      a,
      b,
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

  it('adds an event for a section and a person; attendees see it and are told, others do not see it', async () => {
    const s = await school();
    const created = await call<Event>('POST', '/events', s.rinaToken, {
      type: 'PARENT_MEETING',
      title: '  Parent meeting, Class 6 A ',
      starts_at: at(5 * DAY),
      ends_at: at(5 * DAY + 2 * HOUR),
      place: 'Main hall',
      section_ids: [s.a],
      user_ids: [s.karim.id],
    });
    expect(created.status).toBe(201);
    expect(created.body.payload).toMatchObject({
      type: 'PARENT_MEETING',
      title: 'Parent meeting, Class 6 A',
      place: 'Main hall',
      whole_org: false,
      status: 'SCHEDULED',
      sections: [{ id: s.a, name: 'A', class_name: 'Class 6' }],
      people: [{ id: s.karim.id, full_name: 'Karim' }],
      created_by: { id: s.rina.id },
      can_edit: true,
    });
    const id = created.body.payload.id;
    expect(await outbox(s.organization.id, 'calendar.event_added')).toEqual([s.mitu.id, s.karim.id].sort());

    expect((await list(s.mituToken)).body.payload.map((e) => e.id)).toEqual([id]);
    expect((await list(s.karimToken)).body.payload.map((e) => e.id)).toEqual([id]);
    expect((await list(s.ownerToken)).body.payload.map((e) => [e.id, e.can_edit])).toEqual([[id, true]]);
    expect((await list(s.rafiToken)).body.payload).toEqual([]);
    expect((await call('GET', `/events/${id}`, s.rafiToken)).status).toBe(404);
    // Karim attends but did not make it: he can't change it.
    expect((await list(s.karimToken)).body.payload[0].can_edit).toBe(false);
    expect((await call('PATCH', `/events/${id}`, s.karimToken, { place: 'Room 5' })).status).toBe(403);
    // Outside the range it is not listed.
    expect((await list(s.mituToken, dateOf(10 * DAY), dateOf(20 * DAY))).body.payload).toEqual([]);
  });

  it('tells attendees of a change or cancellation only within 48 hours of the start', async () => {
    const s = await school();
    const far = (await call<Event>('POST', '/events', s.ownerToken, { type: 'MEETING', title: 'Staff meeting', starts_at: at(10 * DAY), ends_at: at(10 * DAY + HOUR), user_ids: [s.rina.id, s.karim.id] })).body.payload;
    const near = (await call<Event>('POST', '/events', s.ownerToken, { type: 'ACTIVITY', title: 'Sports day', starts_at: at(20 * HOUR), ends_at: at(26 * HOUR), section_ids: [s.a, s.b] })).body.payload;

    // A far event moved further away: no change notice.
    expect((await call('PATCH', `/events/${far.id}`, s.ownerToken, { starts_at: at(11 * DAY), ends_at: at(11 * DAY + HOUR) })).status).toBe(200);
    expect(await outbox(s.organization.id, 'calendar.event_changed')).toEqual([]);
    // A near event moved: everyone attending is told; a title change alone tells nobody.
    expect((await call('PATCH', `/events/${near.id}`, s.ownerToken, { place: 'Field' })).status).toBe(200);
    expect(await outbox(s.organization.id, 'calendar.event_changed')).toEqual([s.mitu.id, s.rafi.id].sort());
    expect((await call('PATCH', `/events/${near.id}`, s.ownerToken, { title: 'Sports day!' })).status).toBe(200);
    expect(await outbox(s.organization.id, 'calendar.event_changed')).toHaveLength(2);
    // Someone added later is told it was added.
    expect((await call('PATCH', `/events/${far.id}`, s.ownerToken, { user_ids: [s.rina.id, s.karim.id, s.mitu.id] })).status).toBe(200);
    expect((await outbox(s.organization.id, 'calendar.event_added')).filter((id) => id === s.mitu.id)).toHaveLength(2);

    const cancelled = await call<Event>('POST', `/events/${near.id}/cancel`, s.ownerToken, { note: 'Rain' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.payload).toMatchObject({ status: 'CANCELLED', can_edit: false });
    expect(await outbox(s.organization.id, 'calendar.event_cancelled')).toEqual([s.mitu.id, s.rafi.id].sort());
    expect((await call('POST', `/events/${far.id}/cancel`, s.ownerToken, {})).status).toBe(200);
    expect(await outbox(s.organization.id, 'calendar.event_cancelled')).toHaveLength(2);
    // Kept, and can't change any more.
    expect(await t.dataSource.getRepository(EventEntity).countBy({ organization_id: s.organization.id })).toBe(2);
    const again = await call('PATCH', `/events/${near.id}`, s.ownerToken, { title: 'X' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('EVENT_CANCELLED');

    await t.app.get(AuditService).flush();
    const actions = (await t.dataSource.getRepository(AuditLogEntity).find({ where: { organization_id: s.organization.id } }))
      .map((row) => row.action)
      .filter((action) => action.startsWith('event.'))
      .sort();
    expect(actions).toEqual(['event.cancel', 'event.cancel', 'event.create', 'event.create', 'event.update', 'event.update', 'event.update', 'event.update']);
  });

  it('lets only owners, admins and assistants invite the whole organisation, and checks attendees and times', async () => {
    const s = await school();
    const whole = await call<Event>('POST', '/events', s.ownerToken, { type: 'OTHER', title: 'Victory Day', starts_at: at(3 * DAY), ends_at: at(3 * DAY + 3 * HOUR), whole_org: true });
    expect(whole.status).toBe(201);
    expect((await list(s.rafiToken)).body.payload.map((e) => e.id)).toEqual([whole.body.payload.id]);
    expect(await outbox(s.organization.id, 'calendar.event_added')).toEqual([s.rina.id, s.karim.id, s.mitu.id, s.rafi.id].sort());

    const base = { type: 'EXAM', title: 'Class test', starts_at: at(DAY), ends_at: at(DAY + HOUR) };
    const notAllowed = await call('POST', '/events', s.rinaToken, { ...base, whole_org: true });
    expect([notAllowed.status, notAllowed.body.code]).toEqual([403, 'EVENT_WHOLE_ORG_FORBIDDEN']);
    const notTaught = await call('POST', '/events', s.rinaToken, { ...base, section_ids: [s.b] });
    expect([notTaught.status, notTaught.body.code]).toEqual([400, 'EVENT_ATTENDEE_INVALID']);
    const stranger = await make.teacher({ full_name: 'Stranger' });
    const outsider = await call('POST', '/events', s.ownerToken, { ...base, user_ids: [stranger.id] });
    expect([outsider.status, outsider.body.code]).toEqual([400, 'EVENT_ATTENDEE_INVALID']);
    const nobody = await call('POST', '/events', s.ownerToken, base);
    expect([nobody.status, nobody.body.code]).toEqual([400, 'EVENT_NO_ATTENDEES']);
    for (const times of [
      { starts_at: at(DAY), ends_at: at(DAY - HOUR) },
      { starts_at: at(-3 * HOUR), ends_at: at(-HOUR) },
      { starts_at: at(DAY), ends_at: at(16 * DAY) },
    ]) {
      const bad = await call('POST', '/events', s.ownerToken, { ...base, ...times, user_ids: [s.rina.id] });
      expect([bad.status, bad.body.code]).toEqual([400, 'EVENT_TIME_INVALID']);
    }
    expect((await call('POST', '/events', s.mituToken, { ...base, user_ids: [s.rina.id] })).status).toBe(403);
    expect((await list(s.ownerToken, dateOf(0), dateOf(70 * DAY))).body.code).toBe('EVENT_TIME_INVALID');

    // Another organisation's event is never found; the plan gate applies.
    const other = await school();
    const theirs = (await call<Event>('POST', '/events', other.ownerToken, { ...base, user_ids: [other.rina.id] })).body.payload;
    expect((await call('GET', `/events/${theirs.id}`, s.ownerToken)).status).toBe(404);
    const off = await school({ calendarOn: false });
    expect((await list(off.ownerToken)).status).toBe(403);
  });
});
