import { DeepPartial, Repository } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';
import { RolesEnum } from '../../src/common/enums/roles.enum';
import { EmailService } from '../../src/email/email.service';
import { SmsCreditLedger1755910000000 } from '../../src/migrations/1755910000000-SmsCreditLedger';
import { PaymentEntity } from '../../src/modules/payment/entities/payment.entity';
import { PaymentStatusEnum } from '../../src/modules/payment/enums/payment-status.enum';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import {
  SmsCreditBucketEnum,
  SmsCreditLedgerEntity,
  SmsCreditReasonEnum,
} from '../../src/notifications/entities/sms-credit-ledger.entity';
import { NotificationDispatcherService } from '../../src/notifications/notification-dispatcher.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, OutboxStatusEnum } from '../../src/notifications/notification.constants';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { creditPeriod, SmsCreditsService } from '../../src/notifications/sms-credits.service';
import { OrganizationEntity } from '../../src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from '../../src/organizations/enums/organization-member-role.enum';
import { SmsService } from '../../src/sms/sms.service';
import { FeatureOverrideEntity } from '../../src/subscriptions/entities/feature-override.entity';
import { SubscriptionPlanEntity } from '../../src/subscriptions/entities/subscription-plan.entity';
import { EntitlementsService } from '../../src/subscriptions/entitlements.service';
import { SubscriptionService } from '../../src/subscriptions/subscription.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

type Summary = {
  period: string;
  allowance: { granted: number; left: number };
  top_up: { left: number };
  total_left: number;
  low: boolean;
  packs: Array<{ id: string; credits: number; price: number }>;
};

/**
 * SMS credits (P2-08 part 2, FND-13): a monthly allowance from the plan plus top-ups, spent
 * allowance first; at zero SMS stop and are logged "Not sent — no credit". Providers are faked.
 */
describe('SMS credits', () => {
  let t: TestApp;
  let make: ReturnType<typeof factories>;
  let ledger: Repository<SmsCreditLedgerEntity>;
  let outbox: Repository<NotificationOutboxEntity>;
  let notifications: NotificationsService;
  let dispatcher: NotificationDispatcherService;
  let credits: SmsCreditsService;
  let smsDeliver: jest.SpyInstance;
  let emailDeliver: jest.SpyInstance;
  let admin: UserEntity;

  const sessionApi = 'sslcommerz.test/gwprocess';
  const validationApi = 'sslcommerz.test/validator';

  const orgToken = (user: UserEntity, organization: OrganizationEntity, role = OrganizationMemberRoleEnum.OWNER) =>
    t.tokenFor(user, { session_mode: 'organization', context_type: 'organization', organization_id: organization.id, member_role: role });

  /** A school whose plan gives `allowance` SMS a month (an override, like Admin → Organisations). */
  const schoolWith = async (allowance: number) => {
    const owner = await make.teacher({ personal_teacher_enabled: false });
    const school = await make.organization(owner);
    await t.dataSource
      .getRepository(FeatureOverrideEntity)
      .save({ organization_id: school.id, key: 'sms_credits_per_month', value: allowance } as DeepPartial<FeatureOverrideEntity>);
    await t.app.get(EntitlementsService).invalidate(school.id);
    return { owner, school };
  };

  /** Queues and sends one SMS for the school; `title` sets its length (1 segment unless long). */
  const sendSms = async (school: OrganizationEntity, title = 'Algebra') => {
    const [id] = await notifications.enqueue({
      eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
      channel: NotificationChannelEnum.SMS,
      organizationId: school.id,
      userId: (await make.student({ locale: 'en' })).id,
      variables: { exam_title: title, exam_start_at: '2026-11-02T04:30:00.000Z' },
    });
    const status = await dispatcher.dispatch(id);
    return { id, status, row: await outbox.findOneByOrFail({ id }) };
  };

  const rowsOf = (school: OrganizationEntity) =>
    ledger.find({ where: { organization_id: school.id }, order: { id: 'ASC' } });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    ledger = t.dataSource.getRepository(SmsCreditLedgerEntity);
    outbox = t.dataSource.getRepository(NotificationOutboxEntity);
    notifications = t.app.get(NotificationsService);
    dispatcher = t.app.get(NotificationDispatcherService);
    credits = t.app.get(SmsCreditsService);
    admin = await make.user(RolesEnum.ADMIN);
  });

  beforeEach(() => {
    smsDeliver = jest.spyOn(t.app.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'sms-1' });
    emailDeliver = jest.spyOn(t.app.get(EmailService), 'deliver').mockResolvedValue({ messageId: 'email-1' });
    t.outbound.reset();
  });

  afterEach(() => {
    smsDeliver.mockRestore();
    emailDeliver.mockRestore();
  });

  afterAll(async () => {
    await t.close();
  });

  describe('plan allowance', () => {
    it('gives each preset plan its monthly SMS (Free 50, Basic 300, Premium 1,000, Pro 3,000)', async () => {
      const plans = await t.dataSource.getRepository(SubscriptionPlanEntity).find();
      const allowance = (slug: string) => plans.find((p) => p.slug === slug)?.limits?.sms_credits_per_month;
      expect([allowance('free'), allowance('basic'), allowance('premium'), allowance('pro')]).toEqual([50, 300, 1000, 3000]);
    });

    it("adds the limit to a preset plan that has none, but never changes an admin's value", async () => {
      const plans = t.dataSource.getRepository(SubscriptionPlanEntity);
      const [basic, premium] = [await plans.findOneByOrFail({ slug: 'basic' }), await plans.findOneByOrFail({ slug: 'premium' })];
      const { sms_credits_per_month: _removed, ...withoutSms } = basic.limits as Record<string, number>;
      await plans.update(basic.id, { limits: withoutSms });
      await plans.update(premium.id, { limits: { ...premium.limits, sms_credits_per_month: 123 } });
      try {
        await t.app.get(SubscriptionService).onModuleInit();
        expect((await plans.findOneByOrFail({ id: basic.id })).limits?.sms_credits_per_month).toBe(300);
        expect((await plans.findOneByOrFail({ id: premium.id })).limits?.sms_credits_per_month).toBe(123);
      } finally {
        await plans.update(basic.id, { limits: basic.limits });
        await plans.update(premium.id, { limits: premium.limits });
      }
    });
  });

  describe('the owner’s view', () => {
    it("shows this month's allowance, top-ups and the packs to owners and admins only", async () => {
      const { owner, school } = await schoolWith(40);
      const response = await t.api.get<{ payload: Summary }>('/sms-credits', orgToken(owner, school));
      expect(response.status).toBe(200);
      expect(response.body.payload).toMatchObject({
        period: creditPeriod(new Date(), 'Asia/Dhaka'),
        allowance: { granted: 40, left: 40 },
        top_up: { left: 0 },
        total_left: 40,
        low: false,
      });
      expect(response.body.payload.packs).toEqual([
        { id: 'sms_500', credits: 500, price: 300 },
        { id: 'sms_1000', credits: 1000, price: 550 },
        { id: 'sms_5000', credits: 5000, price: 2500 },
      ]);
      // Reading twice grants once.
      await t.api.get('/sms-credits', orgToken(owner, school));
      expect((await rowsOf(school)).filter((r) => r.reason === SmsCreditReasonEnum.MONTHLY_GRANT)).toHaveLength(1);

      const teacher = await make.teacher();
      await make.member(school, teacher, OrganizationMemberRoleEnum.TEACHER);
      expect((await t.api.get('/sms-credits', orgToken(teacher, school, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);
    });
  });

  describe('sending', () => {
    it('spends the allowance first, then top-ups, one credit per segment', async () => {
      const { school } = await schoolWith(3);
      await credits.addTopUp(school.id, 5, { note: 'test' });

      expect((await sendSms(school)).row.credits_used).toBe(1);
      expect((await sendSms(school)).row.credits_used).toBe(1);
      // A long message: 2 segments, the last allowance credit and one top-up credit.
      const long = await sendSms(school, 'x'.repeat(170));
      expect(long.status).toBe(OutboxStatusEnum.SENT);
      expect(long.row.credits_used).toBe(2);

      const sends = (await rowsOf(school)).filter((r) => r.outbox_id === long.id);
      expect(sends.map((r) => [r.bucket, r.delta])).toEqual([
        [SmsCreditBucketEnum.ALLOWANCE, -1],
        [SmsCreditBucketEnum.TOPUP, -1],
      ]);
      expect(await credits.summary(school.id)).toMatchObject({ allowance: { granted: 3, left: 0 }, top_up: { left: 4 }, total_left: 4 });
    });

    it('stops SMS at zero credits and logs "Not sent — no credit", while email still goes out', async () => {
      const { school } = await schoolWith(1);
      expect((await sendSms(school)).status).toBe(OutboxStatusEnum.SENT);
      smsDeliver.mockClear();

      const stopped = await sendSms(school);
      expect(stopped.status).toBe(OutboxStatusEnum.NO_CREDIT);
      expect(stopped.row).toMatchObject({ error: 'Not sent — no credit', credits_used: 0 });
      expect(smsDeliver).not.toHaveBeenCalled();

      const [emailId] = await notifications.enqueue({
        eventType: NOTIFICATION_EVENTS.CLASS_INVITATION,
        channel: NotificationChannelEnum.EMAIL,
        organizationId: school.id,
        address: 'parent@test.local',
        variables: { class_name: 'Class 6', inviter_name: 'Rina', link: 'http://localhost:3000' },
      });
      await expect(dispatcher.dispatch(emailId)).resolves.toBe(OutboxStatusEnum.SENT);
    });

    it('charges a retried message once and refunds it when it fails for good', async () => {
      const { school } = await schoolWith(5);
      smsDeliver.mockRejectedValue(new Error('gateway down'));
      const { id } = await sendSms(school);
      expect(await credits.summary(school.id)).toMatchObject({ total_left: 4 });

      for (let attempt = 2; attempt <= 3; attempt++) {
        await outbox.update(id, { send_after: new Date(Date.now() - 1000) });
        await dispatcher.dispatch(id);
      }
      const row = await outbox.findOneByOrFail({ id });
      expect(row).toMatchObject({ status: OutboxStatusEnum.FAILED, attempts: 3, credits_used: 0 });
      const forRow = (await rowsOf(school)).filter((r) => r.outbox_id === id);
      expect(forRow.map((r) => [r.reason, r.delta])).toEqual([
        [SmsCreditReasonEnum.SEND, -1],
        [SmsCreditReasonEnum.REFUND, 1],
      ]);
      expect(await credits.summary(school.id)).toMatchObject({ total_left: 5 });
    });

    it('never charges platform messages such as sign-up codes', async () => {
      const [id] = await notifications.enqueue({
        eventType: NOTIFICATION_EVENTS.AUTH_OTP,
        channel: NotificationChannelEnum.SMS,
        organizationId: null,
        address: '01800000001',
        variables: { otp: '123456' },
      });
      await expect(dispatcher.dispatch(id)).resolves.toBe(OutboxStatusEnum.SENT);
      expect(await ledger.countBy({ outbox_id: id })).toBe(0);
    });

    it('emails the owner once a month when 10% or less of the credits is left', async () => {
      const { owner, school } = await schoolWith(10);
      for (let i = 0; i < 8; i++) await sendSms(school);
      const warnings = () => outbox.findBy({ organization_id: school.id, event_type: NOTIFICATION_EVENTS.SMS_LOW_CREDIT });
      expect(await warnings()).toHaveLength(0);

      await sendSms(school); // 1 of 10 left
      await sendSms(school); // 0 left
      await sendSms(school); // no credit
      const sent = await warnings();
      // In-app and email (FND-13), once this month.
      expect(sent.map((w) => w.channel).sort()).toEqual([NotificationChannelEnum.EMAIL, NotificationChannelEnum.IN_APP]);
      expect(sent.every((w) => w.recipient_id === owner.id)).toBe(true);
      expect(sent[0].payload).toMatchObject({ credits_left: 1, organization_name: school.name, path: '/billing' });
      expect((await credits.summary(school.id)).low).toBe(true);
    });
  });

  describe('monthly allowance', () => {
    it('expires last month’s unused allowance, grants the new one, keeps top-ups, and is safe to run again', async () => {
      const { school } = await schoolWith(20);
      // Last month: 7 allowance credits left and 4 top-up credits.
      await ledger.save([
        { organization_id: school.id, bucket: SmsCreditBucketEnum.ALLOWANCE, reason: SmsCreditReasonEnum.MONTHLY_GRANT, delta: 7, balance_after: 7, period: '2000-01' },
        { organization_id: school.id, bucket: SmsCreditBucketEnum.TOPUP, reason: SmsCreditReasonEnum.TOPUP, delta: 4, balance_after: 4 },
      ] as DeepPartial<SmsCreditLedgerEntity>[]);

      const first = await credits.grantMonthlyAllowances();
      expect(first.granted).toBeGreaterThanOrEqual(1);
      const again = await credits.grantMonthlyAllowances();
      expect(again.granted).toBe(0);

      const rows = await rowsOf(school);
      const period = creditPeriod(new Date(), 'Asia/Dhaka');
      expect(rows.slice(2).map((r) => [r.reason, r.delta, r.period])).toEqual([
        [SmsCreditReasonEnum.MONTHLY_EXPIRE, -7, period],
        [SmsCreditReasonEnum.MONTHLY_GRANT, 20, period],
      ]);
      expect(await credits.summary(school.id)).toMatchObject({ allowance: { granted: 20, left: 20 }, top_up: { left: 4 }, total_left: 24 });
    });

    it('uses the organisation’s time zone for the month', () => {
      // 18:30 UTC on 31 Oct is already 1 Nov in Dhaka.
      const at = new Date('2026-10-31T18:30:00Z');
      expect(creditPeriod(at, 'Asia/Dhaka')).toBe('2026-11');
      expect(creditPeriod(at, 'UTC')).toBe('2026-10');
    });
  });

  describe('top-ups', () => {
    it('lets a platform admin add credits, recorded in the audit log', async () => {
      const { owner, school } = await schoolWith(0);
      const response = await t.api.post<{ payload: Summary }>(
        `/sms-credits/admin/${school.id}/top-ups`,
        { credits: 250, reason: 'Paid by bank transfer' },
        t.tokenFor(admin),
      );
      expect(response.status).toBe(201);
      expect(response.body.payload).toMatchObject({ top_up: { left: 250 }, total_left: 250 });

      await t.app.get(AuditService).flush();
      const audit = await t.dataSource.getRepository(AuditLogEntity).findOneByOrFail({ action: 'sms_credits.top_up', organization_id: school.id });
      expect(audit).toMatchObject({ actor_id: admin.id, reason: 'Paid by bank transfer', after: { credits: 250, top_up_left: 250 } });

      expect((await t.api.get<{ payload: Summary }>(`/sms-credits/admin/${school.id}`, t.tokenFor(admin))).body.payload.total_left).toBe(250);
      expect((await t.api.post(`/sms-credits/admin/${school.id}/top-ups`, { credits: 5 }, t.tokenFor(owner))).status).toBe(403);
      expect((await t.api.post(`/sms-credits/admin/${school.id}/top-ups`, { credits: 0 }, t.tokenFor(admin))).status).toBe(400);
    });

    it('sells a pack at the server price and adds its credits once when the payment settles', async () => {
      const teacher = await make.teacher();
      const workspace = await make.soloOrganization(teacher);
      t.outbound.respond(sessionApi, () => ({ status: 'SUCCESS', GatewayPageURL: 'https://sslcommerz.test/pay' }));

      const started = await t.api.post<{ payload: { transactionId: string; amount: number; credits: number } }>(
        '/payments/sms-top-up',
        { packId: 'sms_1000', amount: 1 },
        t.tokenFor(teacher),
      );
      expect(started.status).toBe(201);
      expect(started.body.payload).toMatchObject({ amount: 550, credits: 1000 });
      const sessionCall = t.outbound.calls.find((call) => call.url.includes(sessionApi));
      expect(new URLSearchParams(String(sessionCall?.data)).get('total_amount')).toBe('550.00');
      const { transactionId } = started.body.payload;
      const payment = await t.dataSource.getRepository(PaymentEntity).findOneByOrFail({ transactionId });
      expect(payment).toMatchObject({ purpose: 'SMS_CREDITS', organizationId: workspace.id, status: PaymentStatusEnum.PENDING });

      const settle = () => {
        t.outbound.respond(validationApi, () => ({ status: 'VALID', tran_id: transactionId, amount: '550.00', currency_type: 'BDT' }));
        return t.api.request('POST', '/payments/ipn', { form: { tran_id: transactionId, val_id: `val-${transactionId}`, status: 'VALID' } });
      };
      await settle();
      await settle();

      const topUps = (await rowsOf(workspace)).filter((r) => r.reason === SmsCreditReasonEnum.TOPUP);
      expect(topUps.map((r) => [r.delta, r.payment_id])).toEqual([[1000, payment.id]]);
      const view = await t.api.get<{ payload: { status: string; purpose: string; credits: number } }>(
        `/payments/${transactionId}`,
        t.tokenFor(teacher),
      );
      expect(view.body.payload).toMatchObject({ status: 'PAID', purpose: 'SMS_CREDITS', credits: 1000 });
    });

    it('adds nothing for an underpaid pack, refuses unknown packs and non-owners', async () => {
      const teacher = await make.teacher();
      const workspace = await make.soloOrganization(teacher);
      t.outbound.respond(sessionApi, () => ({ status: 'SUCCESS', GatewayPageURL: 'https://sslcommerz.test/pay' }));
      const { transactionId } = (await t.api.post<{ payload: { transactionId: string } }>('/payments/sms-top-up', { packId: 'sms_500' }, t.tokenFor(teacher)))
        .body.payload;
      t.outbound.respond(validationApi, () => ({ status: 'VALID', tran_id: transactionId, amount: '1.00', currency_type: 'BDT' }));
      await t.api.request('POST', '/payments/ipn', { form: { tran_id: transactionId, val_id: `val-${transactionId}`, status: 'VALID' } });
      expect((await rowsOf(workspace)).filter((r) => r.reason === SmsCreditReasonEnum.TOPUP)).toHaveLength(0);

      expect((await t.api.post('/payments/sms-top-up', { packId: 'sms_1' }, t.tokenFor(teacher))).status).toBe(400);
      const { owner, school } = await schoolWith(0);
      const member = await make.teacher();
      await make.member(school, member, OrganizationMemberRoleEnum.TEACHER);
      expect((await t.api.post('/payments/sms-top-up', { packId: 'sms_500' }, orgToken(member, school, OrganizationMemberRoleEnum.TEACHER))).status).toBe(403);
      expect((await t.api.post('/payments/sms-top-up', { packId: 'sms_500' }, orgToken(owner, school))).status).toBe(201);
    });
  });

  it('migration is safe to run twice and reversible', async () => {
    const migration = new SmsCreditLedger1755910000000();
    const runner = t.dataSource.createQueryRunner();
    try {
      await migration.up(runner);
      await migration.down(runner);
      await migration.up(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    expect(await ledger.count()).toBe(0);
  });
});
