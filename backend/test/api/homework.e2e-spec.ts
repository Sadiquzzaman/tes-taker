import { DeepPartial } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { HomeworkClock } from '../../src/homework/homework-clock';
import { HomeworkService } from '../../src/homework/homework.service';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Body<T> = { payload: T; code?: string; message?: string };
type Homework = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  publish_at: string | null;
  subject: { id: string; name: string };
  targets: { offering_id: string; section_label: string; student_ids: string[] | null }[];
  student_count: number;
  can_edit: boolean;
};

const HOUR = 60 * 60_000;

/**
 * Homework (P5-01, HW-01 and HW-02): staff write homework for subject classes (or chosen students),
 * publish it now or later, withdraw it; students see what is set to them and are told in the inbox
 * when it is given and 24 hours before it is due.
 */
describe('homework API', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let clock: HomeworkClock;
  let homework: HomeworkService;
  let admin: UserEntity;

  const call = <T>(method: string, path: string, token: string, body?: unknown) => t.api.request<Body<T>>(method, path, { token, body });
  const setNow = (iso: string | Date) => jest.spyOn(clock, 'now').mockReturnValue(new Date(iso));
  const outboxFor = (eventType: string, userIds: string[]) =>
    t.dataSource
      .getRepository(NotificationOutboxEntity)
      .createQueryBuilder('o')
      .where('o.event_type = :eventType AND o.recipient_id = ANY(:userIds)', { eventType, userIds })
      .getCount();

  /**
   * A school with Class 6: Math (taught by Rina; everyone takes it) and Religion (taught by Karim;
   * only Picked takes it), two students, and the homework feature on.
   */
  const school = async ({ homeworkOn = true } = {}) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const organization = await make.organization(owner);
    const token = (user: UserEntity, role: OrganizationMemberRoleEnum) =>
      t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
    const ownerToken = token(owner, OrganizationMemberRoleEnum.OWNER);
    if (homeworkOn) {
      const enabled = await t.api.request('PUT', `/subscriptions/admin/organizations/${organization.id}/overrides/homework`, {
        body: { value: true, reason: 'P5-01 test' },
        token: t.tokenFor(admin),
      });
      expect(enabled.status).toBe(200);
    }
    const subjects = t.dataSource.getRepository(SubjectEntity);
    const math = await subjects.save({ name: 'Math', code: 'MTH', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const religion = await subjects.save({ name: 'Religion', code: 'REL', organization_id: organization.id } as DeepPartial<SubjectEntity>);
    const classId = (await call<{ id: string }>('POST', '/classes', ownerToken, { class_name: 'Class 6' })).body.payload.id;
    for (const subject of [math, religion]) await call('POST', `/classes/${classId}/subjects`, ownerToken, { subject_id: subject.id });
    const [picked, other] = [await make.student({ full_name: 'Picked' }), await make.student({ full_name: 'Other' })];
    await call('POST', `/classes/${classId}/students`, ownerToken, { students: [picked.email, other.email] });
    const [section] = (await call<{ id: string }[]>('GET', `/classes/${classId}/sections`, ownerToken)).body.payload;
    const offerings = (await call<{ id: string; subject: { id: string } }[]>('GET', `/sections/${section.id}/offerings`, ownerToken)).body.payload;
    const mathOffering = offerings.find((o) => o.subject.id === math.id)!.id;
    const religionOffering = offerings.find((o) => o.subject.id === religion.id)!.id;
    const rina = await make.teacher({ full_name: 'Rina' });
    const karim = await make.teacher({ full_name: 'Karim' });
    for (const teacher of [rina, karim]) await make.member(organization, teacher, OrganizationMemberRoleEnum.TEACHER);
    await call('PUT', `/offerings/${mathOffering}/teachers`, ownerToken, { teacher_ids: [rina.id] });
    await call('PUT', `/offerings/${religionOffering}/teachers`, ownerToken, { teacher_ids: [karim.id] });
    await call('PATCH', `/offerings/${religionOffering}`, ownerToken, { enrolment_mode: 'SELECTED' });
    await call('PUT', `/offerings/${religionOffering}/students`, ownerToken, { student_ids: [picked.id] });
    return {
      organization,
      owner,
      ownerToken,
      rinaToken: token(rina, OrganizationMemberRoleEnum.TEACHER),
      karimToken: token(karim, OrganizationMemberRoleEnum.TEACHER),
      picked,
      other,
      pickedToken: token(picked, OrganizationMemberRoleEnum.STUDENT),
      otherToken: token(other, OrganizationMemberRoleEnum.STUDENT),
      mathOffering,
      religionOffering,
      sectionId: section.id,
    };
  };

  const draft = (offeringIds: string[], extra: Record<string, unknown> = {}) => ({
    title: 'Chapter 3 exercise',
    instructions: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Do 1 to 10.' }] }] },
    submission_type: 'FILE',
    total_marks: 10,
    due_at: new Date(Date.now() + 3 * 24 * HOUR).toISOString(),
    offering_ids: offeringIds,
    ...extra,
  });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    clock = t.app.get(HomeworkClock);
    homework = t.app.get(HomeworkService);
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

  it('saves a draft that only staff see, then publishes it to the subject class and tells its students', async () => {
    const s = await school();
    const created = await call<Homework>('POST', '/homework', s.rinaToken, draft([s.mathOffering]));
    expect(created.status).toBe(201);
    expect(created.body.payload).toMatchObject({ status: 'DRAFT', subject: { name: 'Math' }, student_count: 2, can_edit: true });
    expect(created.body.payload.targets).toEqual([{ offering_id: s.mathOffering, section_label: 'Class 6 A', student_ids: null }]);
    const id = created.body.payload.id;

    // A draft is invisible to students.
    expect((await call<Homework[]>('GET', '/homework/mine', s.pickedToken)).body.payload).toEqual([]);
    expect((await call('GET', `/homework/${id}`, s.pickedToken)).status).toBe(404);

    const published = await call<Homework>('POST', `/homework/${id}/publish`, s.rinaToken, {});
    expect(published.status).toBe(200);
    expect(published.body.payload.status).toBe('PUBLISHED');
    expect(await outboxFor('homework.assigned', [s.picked.id, s.other.id])).toBe(2);

    for (const token of [s.pickedToken, s.otherToken]) {
      const mine = await call<Homework[]>('GET', '/homework/mine', token);
      expect(mine.body.payload.map((h) => h.id)).toEqual([id]);
      // Students see neither the chosen students nor the class size, and cannot edit.
      expect(mine.body.payload[0]).toMatchObject({ can_edit: false, student_count: 0 });
    }
  });

  it('sets homework for chosen students only, and only for students who take the subject class', async () => {
    const s = await school();
    const notTaking = await call('POST', '/homework', s.karimToken, draft([s.religionOffering], { student_ids: [s.other.id] }));
    expect(notTaking.status).toBe(400);
    expect(notTaking.body.code).toBe('HOMEWORK_STUDENT_NOT_IN_CLASS');

    const created = await call<Homework>('POST', '/homework', s.ownerToken, draft([s.mathOffering], { student_ids: [s.picked.id] }));
    expect(created.body.payload.targets[0].student_ids).toEqual([s.picked.id]);
    await call('POST', `/homework/${created.body.payload.id}/publish`, s.ownerToken, {});
    expect((await call<Homework[]>('GET', '/homework/mine', s.pickedToken)).body.payload).toHaveLength(1);
    expect((await call<Homework[]>('GET', '/homework/mine', s.otherToken)).body.payload).toEqual([]);
    expect(await outboxFor('homework.assigned', [s.other.id])).toBe(0);
  });

  it('lets a teacher manage only homework of subject classes they teach; students never', async () => {
    const s = await school();
    const refused = await call('POST', '/homework', s.karimToken, draft([s.mathOffering]));
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('HOMEWORK_TARGETS_INVALID');
    expect((await call('POST', '/homework', s.pickedToken, draft([s.mathOffering]))).status).toBe(403);

    const id = (await call<Homework>('POST', '/homework', s.rinaToken, draft([s.mathOffering]))).body.payload.id;
    expect((await call<Homework[]>('GET', '/homework', s.rinaToken)).body.payload.map((h) => h.id)).toEqual([id]);
    expect((await call<Homework[]>('GET', '/homework', s.karimToken)).body.payload).toEqual([]);
    expect((await call('GET', `/homework/${id}`, s.karimToken)).status).toBe(404);
    expect((await call('PATCH', `/homework/${id}`, s.karimToken, { title: 'Mine now' })).status).toBe(404);
    // The owner sees every homework.
    expect((await call<Homework[]>('GET', '/homework', s.ownerToken)).body.payload.map((h) => h.id)).toEqual([id]);
  });

  it('offers each teacher the subject classes they teach, and every one to the owner', async () => {
    const s = await school();
    type Choice = { offering_id: string; section_label: string; subject: { name: string } };
    const choices = async (token: string) => (await call<Choice[]>('GET', '/homework/subject-classes', token)).body.payload;
    expect((await choices(s.rinaToken)).map((c) => [c.offering_id, c.section_label, c.subject.name])).toEqual([[s.mathOffering, 'Class 6 A', 'Math']]);
    expect((await choices(s.karimToken)).map((c) => c.subject.name)).toEqual(['Religion']);
    expect((await choices(s.ownerToken)).map((c) => c.subject.name)).toEqual(['Math', 'Religion']);
    expect((await call('GET', '/homework/subject-classes', s.pickedToken)).status).toBe(403);
  });

  it('refuses mixed subjects, a due time in the past and changing who a published homework is for', async () => {
    const s = await school();
    const mixed = await call('POST', '/homework', s.ownerToken, draft([s.mathOffering, s.religionOffering]));
    expect(mixed.body.code).toBe('HOMEWORK_TARGETS_MIXED');
    const past = await call('POST', '/homework', s.ownerToken, draft([s.mathOffering], { due_at: new Date(Date.now() - HOUR).toISOString() }));
    expect(past.body.code).toBe('HOMEWORK_DUE_INVALID');

    const id = (await call<Homework>('POST', '/homework', s.ownerToken, draft([s.mathOffering]))).body.payload.id;
    await call('POST', `/homework/${id}/publish`, s.ownerToken, {});
    const retarget = await call('PATCH', `/homework/${id}`, s.ownerToken, { student_ids: [s.picked.id] });
    expect(retarget.status).toBe(409);
    expect(retarget.body.code).toBe('HOMEWORK_WRONG_STATUS');
    // The title and due time may still change.
    const due = new Date(Date.now() + 5 * 24 * HOUR).toISOString();
    expect((await call<Homework>('PATCH', `/homework/${id}`, s.ownerToken, { title: 'Exercise 3 (1–5 only)', due_at: due })).body.payload).toMatchObject({
      title: 'Exercise 3 (1–5 only)',
      due_at: due,
    });
  });

  it('publishes a scheduled homework when its time comes, once, and reminds students a day before it is due', async () => {
    const s = await school();
    const start = new Date('2026-12-01T03:00:00Z');
    setNow(start);
    const due = new Date(start.getTime() + 2 * 24 * HOUR);
    const id = (await call<Homework>('POST', '/homework', s.rinaToken, draft([s.mathOffering], { due_at: due.toISOString() }))).body.payload.id;
    const publishAt = new Date(start.getTime() + 2 * HOUR);
    const scheduled = await call<Homework>('POST', `/homework/${id}/publish`, s.rinaToken, { publish_at: publishAt.toISOString() });
    expect(scheduled.body.payload).toMatchObject({ status: 'SCHEDULED', publish_at: publishAt.toISOString() });
    expect((await call<Homework[]>('GET', '/homework/mine', s.pickedToken)).body.payload).toEqual([]);

    setNow(new Date(start.getTime() + HOUR));
    expect((await homework.sweep()).published).toBe(0);
    setNow(new Date(publishAt.getTime() + 60_000));
    expect((await homework.sweep()).published).toBe(1);
    expect((await homework.sweep()).published).toBe(0);
    expect(await outboxFor('homework.assigned', [s.picked.id, s.other.id])).toBe(2);
    expect((await call<Homework[]>('GET', '/homework/mine', s.pickedToken)).body.payload.map((h) => h.id)).toEqual([id]);

    // 24 hours before the due time: one reminder each, however often the job runs.
    setNow(new Date(due.getTime() - 25 * HOUR));
    expect((await homework.sweep()).reminded).toBe(0);
    setNow(new Date(due.getTime() - 23 * HOUR));
    expect((await homework.sweep()).reminded).toBe(1);
    expect((await homework.sweep()).reminded).toBe(0);
    expect(await outboxFor('homework.due_soon', [s.picked.id, s.other.id])).toBe(2);
  });

  it('withdraws a homework: kept for staff, gone for students', async () => {
    const s = await school();
    const id = (await call<Homework>('POST', '/homework', s.ownerToken, draft([s.mathOffering]))).body.payload.id;
    await call('POST', `/homework/${id}/publish`, s.ownerToken, {});
    const cancelled = await call<Homework>('POST', `/homework/${id}/cancel`, s.ownerToken);
    expect(cancelled.body.payload).toMatchObject({ status: 'CANCELLED', can_edit: false });
    expect((await call<Homework[]>('GET', '/homework/mine', s.pickedToken)).body.payload).toEqual([]);
    expect((await call<Homework[]>('GET', '/homework', s.ownerToken)).body.payload).toEqual([]);
    expect((await call<Homework[]>('GET', '/homework?status=CANCELLED', s.ownerToken)).body.payload.map((h) => h.id)).toEqual([id]);
    expect((await call('PATCH', `/homework/${id}`, s.ownerToken, { title: 'Again' })).body.code).toBe('HOMEWORK_WRONG_STATUS');

    await t.app.get(AuditService).flush();
    const actions = (await t.dataSource.getRepository(AuditLogEntity).findBy({ entity_type: 'homework', entity_id: id })).map((a) => a.action).sort();
    expect(actions).toEqual(['homework.cancel', 'homework.create', 'homework.publish']);
  });

  it("makes a closed session's homework read-only", async () => {
    const s = await school();
    const id = (await call<Homework>('POST', '/homework', s.ownerToken, draft([s.mathOffering]))).body.payload.id;
    const [{ session_id }] = await t.dataSource.query(`SELECT session_id FROM homework WHERE id = $1`, [id]);
    // Another session becomes the default first, then this one closes.
    await call('POST', '/sessions', s.ownerToken, { name: 'Next', start_date: '2027-01-01', end_date: '2027-12-31', is_default: true });
    expect((await call('POST', `/sessions/${session_id}/close`, s.ownerToken)).status).toBe(200);
    const refused = await call('POST', `/homework/${id}/publish`, s.ownerToken, {});
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('HOMEWORK_SESSION_CLOSED');
  });

  it('is locked without the homework feature, and never shows another organisation', async () => {
    const locked = await school({ homeworkOn: false });
    const refused = await call('POST', '/homework', locked.ownerToken, draft([locked.mathOffering]));
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('FEATURE_NOT_IN_PLAN');

    const a = await school();
    const b = await school();
    const id = (await call<Homework>('POST', '/homework', a.ownerToken, draft([a.mathOffering]))).body.payload.id;
    expect((await call('GET', `/homework/${id}`, b.ownerToken)).status).toBe(404);
    expect((await call('POST', '/homework', b.ownerToken, draft([a.mathOffering]))).body.code).toBe('HOMEWORK_TARGETS_INVALID');
  });
});

