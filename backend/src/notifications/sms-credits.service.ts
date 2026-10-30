import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { ConfigService } from '@nestjs/config';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { LimitKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { SmsCreditBucketEnum, SmsCreditLedgerEntity, SmsCreditReasonEnum } from './entities/sms-credit-ledger.entity';
import { NOTIFICATION_EVENTS } from './notification.constants';
import { NotificationsService } from './notifications.service';
import { SMS_LOW_CREDIT_SHARE, SMS_TOP_UP_PACKS, SmsTopUpPack } from './sms-top-up-packs';

const DEFAULT_TIME_ZONE = 'Asia/Dhaka';

/** An organisation's SMS credits as the owner sees them (FND-13). */
export interface SmsCreditSummary {
  /** YYYY-MM in the organisation's time zone. */
  period: string;
  allowance: { granted: number; left: number };
  top_up: { left: number };
  total_left: number;
  /** At or below 10% of this month's credits. */
  low: boolean;
  packs: readonly SmsTopUpPack[];
}

/** The calendar month (YYYY-MM) of `date` in `timeZone`. */
export function creditPeriod(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}`;
}

/**
 * SMS credits (FND-13, design §8.6): a monthly allowance from the plan, plus top-ups that carry over.
 * Every change is a `sms_credit_ledger` row, written under a per-organisation advisory lock so two
 * workers can never spend the same credit. The month's allowance is granted the first time the
 * organisation's credits are touched in that month (and by the hourly `billing.sms-allowance` job);
 * whatever is left of the previous month's allowance expires at the same time.
 */
@Injectable()
export class SmsCreditsService {
  private readonly logger = new Logger(SmsCreditsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  /** The owner's view; grants this month's allowance first if needed. */
  summary(organizationId: string): Promise<SmsCreditSummary> {
    return this.dataSource.transaction(async (manager) => {
      await this.lock(manager, organizationId);
      const { period, grant } = await this.ensurePeriod(manager, organizationId);
      return this.summarize(manager, organizationId, period, grant);
    });
  }

  /**
   * Charges `credits` for an outbox row (allowance first, then top-ups) in the caller's transaction.
   * Returns false when there are not enough credits (nothing is charged). Charging the same row
   * again (a retry) is a no-op that returns true.
   */
  async charge(manager: EntityManager, organizationId: string, outboxId: string, credits: number): Promise<boolean> {
    await this.lock(manager, organizationId);
    const { period, grant } = await this.ensurePeriod(manager, organizationId);
    const ledger = manager.getRepository(SmsCreditLedgerEntity);
    if (await ledger.exists({ where: { outbox_id: outboxId, reason: SmsCreditReasonEnum.SEND } })) return true;

    const allowance = await this.balance(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE);
    const topUp = await this.balance(manager, organizationId, SmsCreditBucketEnum.TOPUP);
    let charged = false;
    if (allowance + topUp >= credits) {
      const fromAllowance = Math.min(allowance, credits);
      const fromTopUp = credits - fromAllowance;
      if (fromAllowance > 0) {
        await this.write(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE, SmsCreditReasonEnum.SEND, -fromAllowance, { outbox_id: outboxId });
      }
      if (fromTopUp > 0) {
        await this.write(manager, organizationId, SmsCreditBucketEnum.TOPUP, SmsCreditReasonEnum.SEND, -fromTopUp, { outbox_id: outboxId });
      }
      charged = true;
    }
    await this.warnIfLow(manager, organizationId, period, grant);
    return charged;
  }

  /** Gives back what a message was charged (it failed for good). At most once per message. */
  async refund(manager: EntityManager, organizationId: string, outboxId: string): Promise<number> {
    await this.lock(manager, organizationId);
    const ledger = manager.getRepository(SmsCreditLedgerEntity);
    const sends = await ledger.find({ where: { outbox_id: outboxId, reason: SmsCreditReasonEnum.SEND } });
    let refunded = 0;
    for (const send of sends) {
      if (await ledger.exists({ where: { outbox_id: outboxId, bucket: send.bucket, reason: SmsCreditReasonEnum.REFUND } })) continue;
      await this.write(manager, organizationId, send.bucket, SmsCreditReasonEnum.REFUND, -send.delta, { outbox_id: outboxId });
      refunded += -send.delta;
    }
    return refunded;
  }

  /**
   * Adds top-up credits (they carry over until used). A payment adds its credits once; pass the
   * caller's transaction to commit them with the payment.
   */
  async addTopUp(
    organizationId: string,
    credits: number,
    source: { paymentId?: string; note?: string | null; createdBy?: string | null },
    manager?: EntityManager,
  ): Promise<{ added: boolean; summary: SmsCreditSummary }> {
    const run = async (m: EntityManager) => {
      await this.lock(m, organizationId);
      const { period, grant } = await this.ensurePeriod(m, organizationId);
      const ledger = m.getRepository(SmsCreditLedgerEntity);
      const duplicate = source.paymentId ? await ledger.exists({ where: { payment_id: source.paymentId } }) : false;
      if (!duplicate) {
        await this.write(m, organizationId, SmsCreditBucketEnum.TOPUP, SmsCreditReasonEnum.TOPUP, credits, {
          payment_id: source.paymentId ?? null,
          note: source.note?.trim() || null,
          created_by: source.createdBy ?? null,
        });
      }
      return { added: !duplicate, summary: await this.summarize(m, organizationId, period, grant) };
    };
    return manager ? run(manager) : this.dataSource.transaction(run);
  }

  /** `billing.sms-allowance`: grants the new month (and expires the old one) for every organisation. */
  async grantMonthlyAllowances(): Promise<{ organizations: number; granted: number }> {
    const organizations: Array<{ id: string }> = await this.dataSource
      .getRepository(OrganizationEntity)
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .getRawMany();
    let granted = 0;
    for (const { id } of organizations) {
      try {
        const created = await this.dataSource.transaction(async (manager) => {
          await this.lock(manager, id);
          return (await this.ensurePeriod(manager, id)).created;
        });
        if (created) granted++;
      } catch (error) {
        this.logger.error(`SMS allowance not granted for ${id}: ${(error as Error).message}`);
      }
    }
    return { organizations: organizations.length, granted };
  }

  // ---------------------------------------------------------------------------

  private async lock(manager: EntityManager, organizationId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sms-credits:${organizationId}`]);
  }

  private async balance(manager: EntityManager, organizationId: string, bucket: SmsCreditBucketEnum): Promise<number> {
    const last = await manager.getRepository(SmsCreditLedgerEntity).findOne({
      where: { organization_id: organizationId, bucket },
      order: { id: 'DESC' },
    });
    return last?.balance_after ?? 0;
  }

  private async write(
    manager: EntityManager,
    organizationId: string,
    bucket: SmsCreditBucketEnum,
    reason: SmsCreditReasonEnum,
    delta: number,
    extra: Partial<SmsCreditLedgerEntity> = {},
  ): Promise<SmsCreditLedgerEntity> {
    const balanceAfter = (await this.balance(manager, organizationId, bucket)) + delta;
    return manager.getRepository(SmsCreditLedgerEntity).save({
      organization_id: organizationId,
      bucket,
      reason,
      delta,
      balance_after: balanceAfter,
      ...extra,
    });
  }

  /** This month's grant row, creating it (and expiring last month's allowance) when missing. Caller holds the lock. */
  private async ensurePeriod(
    manager: EntityManager,
    organizationId: string,
  ): Promise<{ period: string; grant: SmsCreditLedgerEntity; created: boolean }> {
    const organization = await manager.findOne(OrganizationEntity, { where: { id: organizationId }, select: ['id', 'timezone'] });
    if (!organization) throw new NotFoundException('Organization not found');
    const period = creditPeriod(new Date(), organization.timezone || DEFAULT_TIME_ZONE);
    const ledger = manager.getRepository(SmsCreditLedgerEntity);
    const existing = await ledger.findOne({
      where: { organization_id: organizationId, bucket: SmsCreditBucketEnum.ALLOWANCE, reason: SmsCreditReasonEnum.MONTHLY_GRANT, period },
    });
    if (existing) return { period, grant: existing, created: false };

    const left = await this.balance(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE);
    if (left !== 0) {
      await this.write(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE, SmsCreditReasonEnum.MONTHLY_EXPIRE, -left, { period });
    }
    const { limits } = await this.entitlements.getEntitlements(organizationId);
    const amount = Math.max(0, Math.floor(Number(limits[LimitKey.SMS_CREDITS_PER_MONTH] ?? 0)));
    const grant = await this.write(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE, SmsCreditReasonEnum.MONTHLY_GRANT, amount, { period });
    return { period, grant, created: true };
  }

  private async summarize(
    manager: EntityManager,
    organizationId: string,
    period: string,
    grant: SmsCreditLedgerEntity,
  ): Promise<SmsCreditSummary> {
    const allowance = await this.balance(manager, organizationId, SmsCreditBucketEnum.ALLOWANCE);
    const topUp = await this.balance(manager, organizationId, SmsCreditBucketEnum.TOPUP);
    const monthTotal = await this.monthTotal(manager, organizationId, grant);
    const total = allowance + topUp;
    return {
      period,
      allowance: { granted: grant.delta, left: allowance },
      top_up: { left: topUp },
      total_left: total,
      low: total <= Math.floor(monthTotal * SMS_LOW_CREDIT_SHARE),
      packs: SMS_TOP_UP_PACKS,
    };
  }

  /** This month's credits: the allowance, the top-ups carried in, and the top-ups added since. */
  private async monthTotal(manager: EntityManager, organizationId: string, grant: SmsCreditLedgerEntity): Promise<number> {
    const [row] = await manager.query(
      `SELECT
         COALESCE((SELECT balance_after FROM sms_credit_ledger
                   WHERE organization_id = $1 AND bucket = 'TOPUP' AND id < $2 ORDER BY id DESC LIMIT 1), 0) AS carried,
         COALESCE((SELECT SUM(delta) FROM sms_credit_ledger
                   WHERE organization_id = $1 AND bucket = 'TOPUP' AND reason = 'TOPUP' AND id > $2), 0) AS added`,
      [organizationId, grant.id],
    );
    return grant.delta + Number(row?.carried ?? 0) + Number(row?.added ?? 0);
  }

  /** Tells the owner(s) (in-app and email) once a month when 10% or less of the month's credits is left. */
  private async warnIfLow(manager: EntityManager, organizationId: string, period: string, grant: SmsCreditLedgerEntity): Promise<void> {
    const summary = await this.summarize(manager, organizationId, period, grant);
    if (!summary.low) return;
    const [organization, owners] = await Promise.all([
      manager.findOne(OrganizationEntity, { where: { id: organizationId }, select: ['id', 'name'] }),
      manager.find(OrganizationMemberEntity, {
        where: { organization_id: organizationId, role: OrganizationMemberRoleEnum.OWNER, removed_at: IsNull() },
        select: ['id', 'user_id'],
      }),
    ]);
    await this.notifications.notifyUsers(
      {
        eventType: NOTIFICATION_EVENTS.SMS_LOW_CREDIT,
        organizationId,
        userIds: owners.map((owner) => owner.user_id),
        variables: {
          organization_name: organization?.name ?? '',
          credits_left: summary.total_left,
          link: `${resolveFrontendUrl(this.configService)}/billing`,
          path: '/billing',
        },
        dedupeKey: `sms.low_credit:${organizationId}:${period}`,
      },
      manager,
    );
  }
}
