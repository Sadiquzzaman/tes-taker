import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { DeepPartial, Repository } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { EmailService } from '../../src/email/email.service';
import { NotificationOutbox1755900000000 } from '../../src/migrations/1755900000000-NotificationOutbox';
import { MessageTemplateEntity } from '../../src/notifications/entities/message-template.entity';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { NotificationDispatcherService } from '../../src/notifications/notification-dispatcher.service';
import {
  NOTIFICATION_EVENTS,
  NotificationChannelEnum,
  OutboxStatusEnum,
  RecipientTypeEnum,
} from '../../src/notifications/notification.constants';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { NOTIFICATIONS_QUEUE } from '../../src/queue/queue.constants';
import { SmsService } from '../../src/sms/sms.service';
import { AccountSubscriptionEntity, SubscriptionStatusEnum } from '../../src/subscriptions/entities/account-subscription.entity';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { SubjectEntity } from '../../src/subjects/entities/subject.entity';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Payload<T> = { payload: T };
type LogPage = {
  payload: Array<{
    id: string;
    event_type: string;
    channel: string;
    status: string;
    recipient: { id: string; full_name: string | null } | null;
    body: string | null;
    credits_used: number;
  }>;
  meta: { total: number };
};

/**
 * Notifications, part 1 (P2-08, design §8.6): every SMS and email goes through the outbox, the
 * worker's dispatcher sends it (fake providers here), and owners read the message log (FND-14).
 */
describe('notifications: outbox, dispatch and message log', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let outbox: Repository<NotificationOutboxEntity>;
  let notifications: NotificationsService;
  let dispatcher: NotificationDispatcherService;
  let smsDeliver: jest.SpyInstance;
  let emailDeliver: jest.SpyInstance;
  let owner: UserEntity;
  let school: OrganizationEntity;

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });
  const call = <T>(method: string, path: string, token?: string, body?: unknown) => t.api.request<T>(method, path, { token, body });
  const rowsOf = (eventType: string) => outbox.find({ where: { event_type: eventType }, order: { created_at: 'ASC' } });
  const dispatchAll = async (rows: Array<{ id: string }>) => {
    for (const row of rows) await dispatcher.dispatch(row.id);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    outbox = t.dataSource.getRepository(NotificationOutboxEntity);
    notifications = t.app.get(NotificationsService);
    dispatcher = t.app.get(NotificationDispatcherService);
    owner = await make.teacher({ personal_teacher_enabled: false });
    school = await make.organization(owner);
  });

  beforeEach(async () => {
    // The fake providers: nothing leaves the test.
    smsDeliver = jest.spyOn(t.app.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'sms-1' });
    emailDeliver = jest.spyOn(t.app.get(EmailService), 'deliver').mockResolvedValue({ messageId: 'email-1' });
    await outbox.clear();
  });

  afterEach(() => {
    smsDeliver.mockRestore();
    emailDeliver.mockRestore();
  });

  afterAll(async () => {
    await t.close();
  });

  const smsTo = (user: UserEntity, extra: Partial<Parameters<NotificationsService['enqueue']>[0]> = {}) =>
    notifications.enqueue({
      eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
      channel: NotificationChannelEnum.SMS,
      organizationId: school.id,
      userId: user.id,
      variables: { exam_title: 'Algebra', exam_start_at: '2026-11-02T04:30:00.000Z' },
      ...extra,
    });

  describe('enqueue', () => {
    it('saves a PENDING row and queues a job for it', async () => {
      const student = await make.student();
      const [id] = await smsTo(student);

      const row = await outbox.findOneByOrFail({ id });
      expect(row).toMatchObject({
        status: OutboxStatusEnum.PENDING,
        organization_id: school.id,
        recipient_type: RecipientTypeEnum.USER,
        recipient_id: student.id,
        to_address: null,
        attempts: 0,
      });
      const job = await t.app.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE)).getJob(id);
      expect(job?.data).toEqual({ outboxId: id });
    });

    it('writes nothing when the caller’s transaction rolls back', async () => {
      const student = await make.student();
      await t.dataSource
        .transaction(async (manager) => {
          await notifications.enqueue(
            { eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: NotificationChannelEnum.SMS, organizationId: school.id, userId: student.id, dedupeKey: 'rolled-back' },
            manager,
          );
          throw new Error('rollback');
        })
        .catch(() => undefined);
      expect(await outbox.countBy({ dedupe_key: 'rolled-back' })).toBe(0);
    });

    it('ignores a second message with the same dedupe key', async () => {
      const student = await make.student();
      expect(await smsTo(student, { dedupeKey: 'once' })).toHaveLength(1);
      expect(await smsTo(student, { dedupeKey: 'once' })).toHaveLength(0);
      expect(await outbox.countBy({ dedupe_key: 'once' })).toBe(1);
    });

    it('skips a message without a recipient', async () => {
      expect(
        await notifications.enqueue({ eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: NotificationChannelEnum.SMS, organizationId: school.id, address: ' ' }),
      ).toEqual([]);
    });
  });

  describe('dispatch (the worker)', () => {
    it("sends an SMS in the recipient's language and records it", async () => {
      const student = await make.student({ locale: 'bn' });
      const [id] = await smsTo(student);

      await expect(dispatcher.dispatch(id)).resolves.toBe(OutboxStatusEnum.SENT);

      expect(smsDeliver).toHaveBeenCalledTimes(1);
      const [phone, text] = smsDeliver.mock.calls[0];
      expect(phone).toBe(student.phone);
      expect(text).toContain('আসন্ন পরীক্ষা "Algebra"');
      expect(text).toContain('১০:৩০'); // 04:30 UTC in Dhaka, Bangla digits
      const row = await outbox.findOneByOrFail({ id });
      expect(row).toMatchObject({ status: OutboxStatusEnum.SENT, locale: 'bn', to_address: student.phone, body: text, provider_msg_id: 'sms-1', attempts: 1 });
      expect(row.sent_at).toBeInstanceOf(Date);
      expect(row.credits_used).toBeGreaterThanOrEqual(1);
    });

    it("uses the organisation's language when the user has none, then English", async () => {
      const student = await make.student({ locale: null });
      const englishSchool = await make.organization(await make.teacher(), { default_locale: 'en' });
      const [id] = await smsTo(student, { organizationId: englishSchool.id });
      await dispatcher.dispatch(id);
      expect(smsDeliver.mock.calls[0][1]).toContain('Upcoming test "Algebra"');
    });

    it('sends an email with its subject in the layout, with variables escaped', async () => {
      const [id] = await notifications.enqueue({
        eventType: NOTIFICATION_EVENTS.CLASS_INVITATION,
        channel: NotificationChannelEnum.EMAIL,
        organizationId: school.id,
        address: 'invitee@test.local',
        locale: 'en',
        variables: { class_name: 'Class <6>', inviter_name: 'Rina', link: 'http://localhost:3000/join/class/1' },
      });
      await dispatcher.dispatch(id);

      const [to, subject, html] = emailDeliver.mock.calls[0];
      expect(to).toBe('invitee@test.local');
      expect(subject).toBe('Invitation to join Class <6> on Instructor');
      expect(html).toContain('<strong>Class &lt;6&gt;</strong>');
      expect(html).toContain('lang="en"');
      expect((await outbox.findOneByOrFail({ id })).credits_used).toBe(0);
    });

    it('retries a failed send later and gives up after 3 attempts', async () => {
      smsDeliver.mockRejectedValue(new Error('gateway down'));
      const [id] = await smsTo(await make.student());

      await expect(dispatcher.dispatch(id)).resolves.toBe(OutboxStatusEnum.PENDING);
      let row = await outbox.findOneByOrFail({ id });
      expect(row).toMatchObject({ attempts: 1, error: 'gateway down' });
      expect(row.send_after!.getTime()).toBeGreaterThan(Date.now());
      // Not due yet: nothing happens.
      await expect(dispatcher.dispatch(id)).resolves.toBeNull();

      for (const expected of [OutboxStatusEnum.PENDING, OutboxStatusEnum.FAILED]) {
        await outbox.update(id, { send_after: new Date(Date.now() - 1000) });
        await expect(dispatcher.dispatch(id)).resolves.toBe(expected);
      }
      row = await outbox.findOneByOrFail({ id });
      expect(row).toMatchObject({ status: OutboxStatusEnum.FAILED, attempts: 3, error: 'gateway down' });
      expect(smsDeliver).toHaveBeenCalledTimes(3);
    });

    it('never sends a row twice, even when two workers pick it up at once', async () => {
      let release: () => void = () => undefined;
      smsDeliver.mockImplementation(() => new Promise((resolve) => (release = () => resolve({ messageId: 'x' }))));
      const [id] = await smsTo(await make.student());

      const first = dispatcher.dispatch(id);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await expect(dispatcher.dispatch(id)).resolves.toBeNull();
      release();
      await expect(first).resolves.toBe(OutboxStatusEnum.SENT);
      expect(smsDeliver).toHaveBeenCalledTimes(1);
    });

    it('fails a row without an address without calling the provider', async () => {
      const student = await make.student();
      await t.dataSource.getRepository(UserEntity).update(student.id, { email: null as unknown as string });
      const [id] = await notifications.enqueue({
        eventType: NOTIFICATION_EVENTS.CLASS_INVITATION,
        channel: NotificationChannelEnum.EMAIL,
        organizationId: school.id,
        userId: student.id,
      });
      await expect(dispatcher.dispatch(id)).resolves.toBe(OutboxStatusEnum.FAILED);
      expect((await outbox.findOneByOrFail({ id })).error).toBe('No email address');
      expect(emailDeliver).not.toHaveBeenCalled();
    });

    it('sweeps due rows and fails rows a crashed worker left SENDING, without re-sending them', async () => {
      const [due] = await smsTo(await make.student());
      const [stuck] = await smsTo(await make.student());
      await t.dataSource.query(
        `UPDATE notification_outbox SET status = 'SENDING', updated_at = now() - interval '11 minutes' WHERE id = $1`,
        [stuck],
      );

      await expect(dispatcher.sweep()).resolves.toEqual({ dispatched: 1, interrupted: 1 });
      expect((await outbox.findOneByOrFail({ id: due })).status).toBe(OutboxStatusEnum.SENT);
      expect((await outbox.findOneByOrFail({ id: stuck })).status).toBe(OutboxStatusEnum.FAILED);
      expect(smsDeliver).toHaveBeenCalledTimes(1);
    });

    it("uses a platform admin's edit of a template", async () => {
      const templates = t.dataSource.getRepository(MessageTemplateEntity);
      const template = await templates.findOneByOrFail({ event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: NotificationChannelEnum.SMS, locale: 'en' });
      const original = template.body;
      await templates.update(template.id, { body: 'Test {{exam_title}} soon' });
      try {
        const [id] = await smsTo(await make.student({ locale: 'en' }));
        await dispatcher.dispatch(id);
        expect(smsDeliver.mock.calls[0][1]).toBe('Test Algebra soon');
      } finally {
        await templates.update(template.id, { body: original });
      }
    });
  });

  describe('senders moved onto the outbox', () => {
    it('queues the sign-up code as an urgent platform SMS, and the code works', async () => {
      const phone = '01811111111';
      const sent = await call('POST', '/sms/send-otp', undefined, { phone });
      expect(sent.status).toBe(201);
      expect(sent.body).toMatchObject({ error: false, message: expect.stringContaining('OTP sent') });
      expect(smsDeliver).not.toHaveBeenCalled(); // never from the request

      const [row] = await rowsOf(NOTIFICATION_EVENTS.AUTH_OTP);
      expect(row).toMatchObject({ organization_id: null, urgent: true, to_address: phone, recipient_type: RecipientTypeEnum.ADDRESS });
      await dispatcher.dispatch(row.id);

      const code = /(\d{6})/.exec(smsDeliver.mock.calls[0][1])![1];
      const after = await outbox.findOneByOrFail({ id: row.id });
      // The code is not kept in the log, and platform messages cost no credits.
      expect(after).toMatchObject({ status: OutboxStatusEnum.SENT, payload: {}, body: null, credits_used: 0 });
      const verified = await call('POST', '/sms/verify-otp', undefined, { phone, otp: code });
      expect(verified.body).toMatchObject({ error: false, message: 'OTP verified successfully.' });
    });

    it("queues the password-reset code by email in the user's language", async () => {
      const user = await make.teacher({ locale: 'bn' });
      const response = await call('POST', '/auth/forgot-password', undefined, { identifier: user.email });
      expect(response.status).toBeLessThan(300);

      const [row] = await rowsOf(NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET);
      expect(row).toMatchObject({ channel: NotificationChannelEnum.EMAIL, urgent: true, recipient_id: user.id, to_address: user.email });
      await dispatcher.dispatch(row.id);
      expect(emailDeliver.mock.calls[0][1]).toBe('আপনার Instructor পাসওয়ার্ড রিসেট করুন');
    });

    it('queues an organisation invitation email', async () => {
      const response = await call('POST', `/organizations/${school.id}/members`, orgToken(owner, school), {
        email: `new-${randomUUID().slice(0, 6)}@test.local`,
        role: OrganizationMemberRoleEnum.TEACHER,
      });
      expect(response.status).toBe(201);
      const [row] = await rowsOf(NOTIFICATION_EVENTS.ORGANIZATION_INVITATION);
      expect(row).toMatchObject({ organization_id: school.id, channel: NotificationChannelEnum.EMAIL, created_by: owner.id });
      expect(row.payload).toMatchObject({ role: 'TEACHER', organization_name: school.name });
    });

    it('queues one "test scheduled" SMS per student of the class, never from the request', async () => {
      const pro = await t.dataSource.getRepository(SubscriptionPlanEntity).findOneByOrFail({ slug: 'pro' });
      await t.dataSource.getRepository(AccountSubscriptionEntity).save({
        organization_id: school.id,
        plan_id: pro.id,
        price_due: 0,
        amount_paid: 0,
        status: SubscriptionStatusEnum.ACTIVE,
        start_date: new Date(),
      } as DeepPartial<AccountSubscriptionEntity>);
      const subject = await t.dataSource
        .getRepository(SubjectEntity)
        .save({ name: 'Math', code: `M${randomUUID().slice(0, 4)}`, organization_id: school.id } as DeepPartial<SubjectEntity>);
      const asOwner = orgToken(owner, school);
      const classId = (await call<Payload<{ id: string }>>('POST', '/classes', asOwner, { class_name: 'Class 7' })).body.payload.id;
      await call('POST', `/classes/${classId}/subjects`, asOwner, { subject_id: subject.id });
      const [a, b] = [await make.student(), await make.student()];
      await call('POST', `/classes/${classId}/students`, asOwner, { students: [a.email, b.email] });
      const [section] = (await call<Payload<Array<{ id: string }>>>('GET', `/classes/${classId}/sections`, asOwner)).body.payload;
      const [offering] = (await call<Payload<Array<{ id: string }>>>('GET', `/sections/${section.id}/offerings`, asOwner)).body.payload;
      await call('PUT', `/offerings/${offering.id}/teachers`, asOwner, { teacher_ids: [owner.id] });

      const correct = randomUUID();
      const created = await call('POST', '/exams', asOwner, {
        formState: { testName: 'Quiz', duration: '30', passingScore: '', allowNegativeMarking: false, negativeMarking: '', isModelTest: false },
        subjects: [
          {
            id: subject.id,
            questions: [
              {
                id: randomUUID(),
                type: 'graded',
                subType: 'multiple-choice',
                text: 'Pick one',
                instruction: '',
                image: null,
                answer: { type: 'optionId', value: [correct] },
                options: [
                  { id: correct, text: 'A', image: null },
                  { id: randomUUID(), text: 'B', image: null },
                  { id: randomUUID(), text: 'C', image: null },
                ],
                points: 1,
                showValidation: false,
              },
            ],
          },
        ],
        publishState: {
          publishTiming: 'later',
          scheduleAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          endingAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          testAudience: 'selected_class',
          selectedClassId: classId,
          selectedOfferingId: offering.id,
          excluded_students: [],
        },
      });
      expect(created.status).toBe(201);

      // Queued in the background after the save.
      let rows: NotificationOutboxEntity[] = [];
      for (let i = 0; i < 50 && rows.length < 2; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        rows = await rowsOf(NOTIFICATION_EVENTS.EXAM_SCHEDULED);
      }
      expect(rows.map((r) => r.recipient_id).sort()).toEqual([a.id, b.id].sort());
      expect(rows[0]).toMatchObject({ organization_id: school.id, channel: NotificationChannelEnum.SMS });
      expect(rows[0].payload).toMatchObject({ exam_title: 'Quiz' });
      expect(smsDeliver).not.toHaveBeenCalled();

      await dispatchAll(rows);
      expect(smsDeliver).toHaveBeenCalledTimes(2);
    });

    it('emails every platform admin about a new feature request (FND-08)', async () => {
      const admin = await make.user(RolesEnum.ADMIN);
      const solo = await make.teacher();
      const workspace = await make.soloOrganization(solo);
      const token = orgToken(solo, workspace);
      const response = await call('POST', '/me/feature-requests', token, { feature_key: 'advanced_analytics', note: 'For our exams' });
      expect(response.status).toBe(201);

      const rows = await rowsOf(NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED);
      expect(rows.map((r) => r.recipient_id)).toContain(admin.id);
      expect(rows.every((r) => r.organization_id === null && r.channel === NotificationChannelEnum.EMAIL)).toBe(true);
      const mine = rows.find((r) => r.recipient_id === admin.id)!;
      expect(mine.payload).toMatchObject({ feature: 'Advanced analytics', organization_name: workspace.name, note: 'For our exams' });
      await dispatcher.dispatch(mine.id);
      expect(emailDeliver).toHaveBeenCalledWith(admin.email, expect.stringContaining('Advanced analytics'), expect.any(String));
    });
  });

  describe('message log (FND-14)', () => {
    it("shows the owner their organisation's messages only, with filters", async () => {
      const student = await make.student();
      const [examSms] = await smsTo(student);
      await smsTo(await make.student());
      await notifications.enqueue({ eventType: NOTIFICATION_EVENTS.AUTH_OTP, channel: NotificationChannelEnum.SMS, organizationId: null, address: '01800000000' });
      const other = await make.organization(await make.teacher());
      await smsTo(student, { organizationId: other.id });
      await dispatcher.dispatch(examSms);

      const token = orgToken(owner, school);
      const all = await call<LogPage>('GET', '/notifications/log', token);
      expect(all.status).toBe(200);
      expect(all.body.meta.total).toBe(2);

      const forStudent = await call<LogPage>('GET', `/notifications/log?recipient_id=${student.id}`, token);
      expect(forStudent.body.payload).toHaveLength(1);
      expect(forStudent.body.payload[0]).toMatchObject({
        event_type: 'exam.scheduled',
        channel: 'SMS',
        status: 'SENT',
        recipient: { id: student.id, full_name: student.full_name },
      });
      expect(forStudent.body.payload[0].credits_used).toBeGreaterThan(0);

      expect((await call<LogPage>('GET', '/notifications/log?status=PENDING', token)).body.meta.total).toBe(1);
      expect((await call<LogPage>('GET', '/notifications/log?event_type=exam.', token)).body.meta.total).toBe(2);
      expect((await call<LogPage>('GET', '/notifications/log?channel=EMAIL', token)).body.meta.total).toBe(0);
      const future = new Date(Date.now() + 60_000).toISOString();
      expect((await call<LogPage>('GET', `/notifications/log?from=${future}`, token)).body.meta.total).toBe(0);
    });

    it('is for owners and admins only', async () => {
      const teacher = await make.teacher();
      await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
      const admin = await make.teacher();
      await make.member(school, admin, OrganizationMemberRoleEnum.ADMIN);
      expect((await call('GET', '/notifications/log', orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);
      expect((await call('GET', '/notifications/log', orgToken(admin, school, OrganizationMemberRoleEnum.ADMIN))).status).toBe(200);
    });
  });

  describe('templates (platform admin)', () => {
    it('lists the defaults in both languages and records an edit in the audit log', async () => {
      const admin = await make.user(RolesEnum.ADMIN);
      const token = t.tokenFor(admin);
      const list = await call<Payload<Array<{ id: string; event_type: string; channel: string; locale: string; body: string }>>>(
        'GET',
        '/notifications/admin/templates',
        token,
      );
      expect(list.status).toBe(200);
      const examEn = list.body.payload.find((x) => x.event_type === 'exam.scheduled' && x.channel === 'SMS' && x.locale === 'en')!;
      expect(list.body.payload.some((x) => x.event_type === 'exam.scheduled' && x.locale === 'bn')).toBe(true);

      const edited = await call('PATCH', `/notifications/admin/templates/${examEn.id}`, token, { body: 'New text {{exam_title}}' });
      expect(edited.status).toBe(200);
      await t.app.get(AuditService).flush();
      const audit = await t.dataSource.getRepository(AuditLogEntity).findOneByOrFail({ action: 'message_template.update', entity_id: examEn.id });
      expect(audit).toMatchObject({ actor_id: admin.id, after: { body: 'New text {{exam_title}}' } });
      expect(audit.before).toMatchObject({ body: examEn.body, event_type: 'exam.scheduled' });

      await call('PATCH', `/notifications/admin/templates/${examEn.id}`, token, { body: examEn.body });
    });

    it('is closed to teachers', async () => {
      expect((await call('GET', '/notifications/admin/templates', t.tokenFor(owner))).status).toBe(403);
    });

    it('keeps edited templates when the defaults are seeded again', async () => {
      const templates = t.dataSource.getRepository(MessageTemplateEntity);
      const count = await templates.count();
      const template = await templates.findOneByOrFail({ event_type: NOTIFICATION_EVENTS.AUTH_OTP, locale: 'en' });
      await templates.update(template.id, { body: 'Edited {{otp}}' });
      const { MessageTemplatesService } = await import('../../src/notifications/message-templates.service');
      await t.app.get(MessageTemplatesService).seedDefaults();
      expect(await templates.count()).toBe(count);
      expect((await templates.findOneByOrFail({ id: template.id })).body).toBe('Edited {{otp}}');
      await templates.update(template.id, { body: template.body });
    });
  });

  it('migration is safe to run twice and reversible', async () => {
    const migration = new NotificationOutbox1755900000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.up(runner);
      await migration.down(runner);
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    expect(await t.dataSource.getRepository(NotificationOutboxEntity).count()).toBe(0);
    // The API adds the defaults back at start-up; do it here for any later file.
    const { MessageTemplatesService } = await import('../../src/notifications/message-templates.service');
    await t.app.get(MessageTemplatesService).seedDefaults();
  });
});
