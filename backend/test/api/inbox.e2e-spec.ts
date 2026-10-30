import { Repository } from 'typeorm';
import { NotificationsInbox1755920000000 } from '../../src/migrations/1755920000000-NotificationsInbox';
import { EmailService } from '../../src/email/email.service';
import { NotificationEntity } from '../../src/notifications/entities/notification.entity';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { NotificationDispatcherService } from '../../src/notifications/notification-dispatcher.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, OutboxStatusEnum } from '../../src/notifications/notification.constants';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { SmsService } from '../../src/sms/sms.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Item = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null };
type InboxPage = { payload: Item[]; meta: { total: number; unread: number } };
type Pref = { event_type: string; channels: string[]; allowed: string[] };

/**
 * The in-app inbox behind the top-bar bell, and each user's channel choices (P2-08 part 3, FND-12).
 * The worker delivers IN_APP rows by writing the inbox; SMS and email providers are faked.
 */
describe('in-app notifications and channel choices', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let outbox: Repository<NotificationOutboxEntity>;
  let inbox: Repository<NotificationEntity>;
  let notifications: NotificationsService;
  let dispatcher: NotificationDispatcherService;
  let school: OrganizationEntity;
  let smsDeliver: jest.SpyInstance;
  let emailDeliver: jest.SpyInstance;

  /** "A test was scheduled" for the users on their channels, every row sent. */
  const examNotice = async (users: UserEntity[], key: string) => {
    const ids = await notifications.notifyUsers({
      eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
      organizationId: school.id,
      userIds: users.map((u) => u.id),
      variables: { exam_title: 'Algebra', exam_start_at: '2026-11-02T04:30:00.000Z', path: '/tests' },
      dedupeKey: key,
    });
    for (const id of ids) await dispatcher.dispatch(id);
    return outbox.findByIds(ids);
  };

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    outbox = t.dataSource.getRepository(NotificationOutboxEntity);
    inbox = t.dataSource.getRepository(NotificationEntity);
    notifications = t.app.get(NotificationsService);
    dispatcher = t.app.get(NotificationDispatcherService);
    school = await make.organization(await make.teacher());
    // Plenty of SMS for these tests.
    await t.app.get((await import('../../src/notifications/sms-credits.service')).SmsCreditsService).addTopUp(school.id, 100, {});
  });

  beforeEach(() => {
    smsDeliver = jest.spyOn(t.app.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'sms-1' });
    emailDeliver = jest.spyOn(t.app.get(EmailService), 'deliver').mockResolvedValue({ messageId: 'email-1' });
  });

  afterEach(() => {
    smsDeliver.mockRestore();
    emailDeliver.mockRestore();
  });

  afterAll(async () => {
    await t.close();
  });

  it("delivers in-app messages to the user's inbox in their language, once per row", async () => {
    const student = await make.student({ locale: 'bn' });
    const rows = await examNotice([student], 'inbox-1');

    const inApp = rows.find((r) => r.channel === NotificationChannelEnum.IN_APP)!;
    expect(inApp.status).toBe(OutboxStatusEnum.SENT);
    const items = await inbox.findBy({ user_id: student.id });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'exam.scheduled', title: 'নতুন পরীক্ষা: Algebra', link: '/tests', organization_id: school.id, read_at: null });
    expect(items[0].body).toContain('১০:৩০');
    // The default for a test notice is in-app and SMS.
    expect(rows.map((r) => r.channel).sort()).toEqual([NotificationChannelEnum.IN_APP, NotificationChannelEnum.SMS]);
    expect(smsDeliver).toHaveBeenCalledTimes(1);

    // Dispatching the row again writes nothing new.
    await outbox.update(inApp.id, { status: OutboxStatusEnum.PENDING });
    await dispatcher.dispatch(inApp.id);
    expect(await inbox.countBy({ user_id: student.id })).toBe(1);
  });

  it('lists my notifications with the unread count, and marks one or all read', async () => {
    const student = await make.student({ locale: 'en' });
    await examNotice([student], 'inbox-2a');
    await examNotice([student], 'inbox-2b');
    const token = t.tokenFor(student);

    const page = await t.api.get<InboxPage>('/me/notifications', token);
    expect(page.status).toBe(200);
    expect(page.body.meta).toMatchObject({ total: 2, unread: 2 });
    expect(page.body.payload[0]).toMatchObject({ title: 'New test: Algebra', link: '/tests', read_at: null });
    expect((await t.api.get<{ payload: { count: number } }>('/me/notifications/unread-count', token)).body.payload.count).toBe(2);

    const read = await t.api.request('PATCH', `/me/notifications/${page.body.payload[0].id}/read`, { token });
    expect(read.status).toBe(200);
    expect((await t.api.get<InboxPage>('/me/notifications?unread_only=true', token)).body.meta).toMatchObject({ total: 1, unread: 1 });

    expect((await t.api.post('/me/notifications/read-all', {}, token)).status).toBe(201);
    expect((await t.api.get<{ payload: { count: number } }>('/me/notifications/unread-count', token)).body.payload.count).toBe(0);
  });

  it("never shows or changes someone else's notifications", async () => {
    const [owner, other] = [await make.student(), await make.student()];
    await examNotice([owner], 'inbox-3');
    const [item] = await inbox.findBy({ user_id: owner.id });

    expect((await t.api.get<InboxPage>('/me/notifications', t.tokenFor(other))).body.meta.total).toBe(0);
    expect((await t.api.request('PATCH', `/me/notifications/${item.id}/read`, { token: t.tokenFor(other) })).status).toBe(404);
    expect((await inbox.findOneByOrFail({ id: item.id })).read_at).toBeNull();
    expect((await t.api.get('/me/notifications')).status).toBe(401);
  });

  it('lets a user choose SMS or email for test notices; in-app always stays on', async () => {
    const student = await make.student({ locale: 'en' });
    const token = t.tokenFor(student);
    const prefs = await t.api.get<{ payload: Pref[] }>('/me/notification-prefs', token);
    expect(prefs.body.payload.find((p) => p.event_type === 'exam.scheduled')).toEqual({
      event_type: 'exam.scheduled',
      channels: ['IN_APP', 'SMS'],
      allowed: ['IN_APP', 'SMS', 'EMAIL'],
    });

    const saved = await t.api.request<{ payload: Pref[] }>('PUT', '/me/notification-prefs', {
      token,
      body: { event_type: 'exam.scheduled', channels: ['EMAIL'] },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.payload.find((p) => p.event_type === 'exam.scheduled')?.channels).toEqual(['IN_APP', 'EMAIL']);

    const rows = await examNotice([student], 'inbox-4');
    expect(rows.map((r) => r.channel).sort()).toEqual([NotificationChannelEnum.EMAIL, NotificationChannelEnum.IN_APP]);
    expect(smsDeliver).not.toHaveBeenCalled();
    expect(emailDeliver).toHaveBeenCalledWith(student.email, 'New test: Algebra', expect.any(String));

    const refused = await t.api.request('PUT', '/me/notification-prefs', { token, body: { event_type: 'sms.low_credit', channels: ['SMS'] } });
    expect(refused.status).toBe(400);
    const unknown = await t.api.request('PUT', '/me/notification-prefs', { token, body: { event_type: 'auth.otp', channels: [] } });
    expect(unknown.status).toBe(400);
  });

  it('migration is safe to run twice and reversible', async () => {
    const migration = new NotificationsInbox1755920000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.up(runner);
      await migration.down(runner);
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    expect(await inbox.count()).toBe(0);
  });
});
