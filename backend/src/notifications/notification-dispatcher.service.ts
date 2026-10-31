import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EmailService } from 'src/email/email.service';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { SmsService } from 'src/sms/sms.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import { MessageTemplatesService } from './message-templates.service';
import {
  DISPATCH_MAX_ATTEMPTS,
  DISPATCH_RETRY_DELAYS_MS,
  DISPATCH_STALE_SENDING_MS,
  DISPATCH_SWEEP_BATCH,
  NOTIFICATION_LOCALES,
  NotificationChannelEnum,
  NotificationLocale,
  OutboxStatusEnum,
  SENSITIVE_EVENTS,
} from './notification.constants';
import { SmsCreditsService } from './sms-credits.service';
import { countSmsSegments } from './sms-segments';
import { renderTemplate, wrapEmailHtml } from './template-render';

const DEFAULT_TIME_ZONE = 'Asia/Dhaka';
/** What the message log shows for an SMS stopped at zero credits (FND-13). */
export const NO_CREDIT_ERROR = 'Not sent — no credit';

/** A row claimed for sending, with the text rendered for its recipient. */
interface ClaimedMessage {
  row: NotificationOutboxEntity;
  subject: string | null;
  text: string;
}

const isLocale = (value: unknown): value is NotificationLocale =>
  typeof value === 'string' && (NOTIFICATION_LOCALES as readonly string[]).includes(value);

/**
 * Sends outbox rows (design §8.6, `notifications.dispatch`). Runs in the worker.
 *
 * 1. Claim: lock the row (`FOR UPDATE SKIP LOCKED`), fill in the address, language and text,
 *    mark it SENDING and commit. A row can only be claimed once, so it is never sent twice.
 * 2. Send through the provider (no transaction open while waiting for it). In-app rows are
 *    delivered in step 1: the inbox row is written in the same transaction.
 * 3. Record SENT, or retry later (PENDING with `send_after`), FAILED after the last attempt.
 *
 * An organisation's SMS are charged when claimed (NO_CREDIT and not sent at zero) and refunded
 * if they fail for good.
 */
@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly templates: MessageTemplatesService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly smsCredits: SmsCreditsService,
  ) {}

  /** Sends one row if it is due and not taken; returns its new status (null when skipped). */
  async dispatch(outboxId: string): Promise<OutboxStatusEnum | null> {
    const claimed = await this.dataSource.transaction((manager) => this.claim(manager, outboxId));
    if (!claimed) return null;
    if (claimed.row.status !== OutboxStatusEnum.SENDING) return claimed.row.status;

    try {
      const providerMsgId = await this.send(claimed);
      return this.finish(claimed.row, { status: OutboxStatusEnum.SENT, providerMsgId });
    } catch (error) {
      const message = (error as Error).message?.slice(0, 500) || 'Send failed';
      this.logger.warn(`Notification ${claimed.row.id} (${claimed.row.channel}) attempt ${claimed.row.attempts} failed: ${message}`);
      if (claimed.row.attempts < DISPATCH_MAX_ATTEMPTS) {
        const delay = DISPATCH_RETRY_DELAYS_MS[claimed.row.attempts - 1] ?? DISPATCH_RETRY_DELAYS_MS[DISPATCH_RETRY_DELAYS_MS.length - 1];
        return this.finish(claimed.row, { status: OutboxStatusEnum.PENDING, error: message, retryAt: new Date(Date.now() + delay) });
      }
      return this.finish(claimed.row, { status: OutboxStatusEnum.FAILED, error: message });
    }
  }

  /**
   * `notifications.sweep`: sends due rows whose job was lost (Redis down, a commit after the job
   * ran) and retries, and fails rows a crashed worker left SENDING (not re-sent: it may have gone out).
   */
  async sweep(): Promise<{ dispatched: number; interrupted: number }> {
    const interrupted = await this.dataSource
      .createQueryBuilder()
      .update(NotificationOutboxEntity)
      .set({ status: OutboxStatusEnum.FAILED, error: 'Interrupted while sending; not retried in case it was sent' })
      .where('status = :sending AND updated_at < :stale', {
        sending: OutboxStatusEnum.SENDING,
        stale: new Date(Date.now() - DISPATCH_STALE_SENDING_MS),
      })
      .execute();

    const due: Array<{ id: string }> = await this.dataSource
      .createQueryBuilder(NotificationOutboxEntity, 'o')
      .select('o.id', 'id')
      .where('o.status = :pending', { pending: OutboxStatusEnum.PENDING })
      .andWhere('(o.send_after IS NULL OR o.send_after <= now())')
      .orderBy('o.urgent', 'DESC')
      .addOrderBy('o.created_at', 'ASC')
      .limit(DISPATCH_SWEEP_BATCH)
      .getRawMany();

    let dispatched = 0;
    for (const { id } of due) {
      if (await this.dispatch(id)) dispatched++;
    }
    return { dispatched, interrupted: interrupted.affected ?? 0 };
  }

  private async claim(manager: EntityManager, outboxId: string): Promise<ClaimedMessage | null> {
    const row = await manager
      .createQueryBuilder(NotificationOutboxEntity, 'o')
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .where('o.id = :id', { id: outboxId })
      .andWhere('o.status = :pending', { pending: OutboxStatusEnum.PENDING })
      .andWhere('(o.send_after IS NULL OR o.send_after <= now())')
      .getOne();
    if (!row) return null;

    const user = row.recipient_id
      ? await manager.findOne(UserEntity, { where: { id: row.recipient_id }, select: ['id', 'phone', 'email', 'locale'] })
      : null;
    const organization = row.organization_id
      ? await manager.findOne(OrganizationEntity, { where: { id: row.organization_id }, select: ['id', 'timezone', 'default_locale'] })
      : null;

    const locale: NotificationLocale = isLocale(row.locale)
      ? row.locale
      : isLocale(user?.locale)
        ? user.locale
        : isLocale(organization?.default_locale)
          ? organization.default_locale
          : 'en';
    row.locale = locale;
    row.to_address = row.to_address ?? this.addressOf(row.channel, user);

    const fail = async (error: string): Promise<ClaimedMessage> => {
      row.status = OutboxStatusEnum.FAILED;
      row.error = error;
      this.forgetSecrets(row);
      await manager.save(row);
      return { row, subject: null, text: '' };
    };

    const inApp = row.channel === NotificationChannelEnum.IN_APP;
    if (inApp && !user) return fail('No user');
    if (!inApp && !row.to_address) return fail(row.channel === NotificationChannelEnum.EMAIL ? 'No email address' : 'No phone number');

    const template = await this.templates.resolve(row.event_type, row.channel, locale, row.organization_id);
    if (!template) return fail(`No template for ${row.event_type} (${row.channel})`);

    const timeZone = organization?.timezone || DEFAULT_TIME_ZONE;
    const variables = row.payload ?? {};
    const isEmail = row.channel === NotificationChannelEnum.EMAIL;
    const subject = template.subject ? renderTemplate(template.subject, variables, { locale, timeZone, html: false }) : null;
    const text = renderTemplate(template.body, variables, { locale, timeZone, html: isEmail });

    row.subject = subject ? subject.slice(0, 200) : null;

    // In-app: the inbox row is the delivery (the bell), written in this transaction, once per row.
    if (inApp) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(NotificationEntity)
        .values({
          user_id: (user as UserEntity).id,
          organization_id: row.organization_id,
          outbox_id: row.id,
          type: row.event_type,
          title: (subject ?? row.event_type).slice(0, 200),
          body: text || null,
          link: this.linkOf(variables),
        })
        .orIgnore()
        .execute();
      row.body = text;
      row.status = OutboxStatusEnum.SENT;
      row.attempts += 1;
      row.sent_at = new Date();
      row.error = null;
      await manager.save(row);
      return { row, subject, text };
    }

    // Codes are never stored in the log.
    row.body = SENSITIVE_EVENTS.has(row.event_type) ? null : text;

    // An organisation's SMS use its credits (FND-13); platform messages (sign-up codes) never do.
    row.credits_used = 0;
    if (row.channel === NotificationChannelEnum.SMS && row.organization_id) {
      const credits = countSmsSegments(text);
      if (!(await this.smsCredits.charge(manager, row.organization_id, row.id, credits))) {
        row.status = OutboxStatusEnum.NO_CREDIT;
        row.error = NO_CREDIT_ERROR;
        this.forgetSecrets(row);
        await manager.save(row);
        return { row, subject, text };
      }
      row.credits_used = credits;
    }
    row.status = OutboxStatusEnum.SENDING;
    row.attempts += 1;
    row.error = null;
    await manager.save(row);
    return { row, subject, text };
  }

  /** A path inside the web app for the inbox item (never an outside URL). */
  private linkOf(variables: Record<string, unknown>): string | null {
    const link = typeof variables.path === 'string' ? variables.path : null;
    return link && link.startsWith('/') && !link.startsWith('//') ? link.slice(0, 300) : null;
  }

  private addressOf(channel: NotificationChannelEnum, user: UserEntity | null): string | null {
    if (!user) return null;
    if (channel === NotificationChannelEnum.SMS) return user.phone || null;
    if (channel === NotificationChannelEnum.EMAIL) return user.email || null;
    return null;
  }

  private async send({ row, subject, text }: ClaimedMessage): Promise<string | null> {
    switch (row.channel) {
      case NotificationChannelEnum.SMS:
        return (await this.smsService.deliver(row.to_address as string, text)).messageId;
      case NotificationChannelEnum.EMAIL:
        return (await this.emailService.deliver(row.to_address as string, subject ?? '', wrapEmailHtml(text, row.locale as NotificationLocale)))
          .messageId;
      default:
        throw new Error(`Channel ${row.channel} is not supported yet`);
    }
  }

  private async finish(
    row: NotificationOutboxEntity,
    outcome: { status: OutboxStatusEnum; providerMsgId?: string | null; error?: string; retryAt?: Date },
  ): Promise<OutboxStatusEnum> {
    row.status = outcome.status;
    row.error = outcome.error ?? null;
    row.provider_msg_id = outcome.providerMsgId?.slice(0, 100) ?? null;
    if (outcome.status === OutboxStatusEnum.SENT) row.sent_at = new Date();
    if (outcome.retryAt) row.send_after = outcome.retryAt;
    if (outcome.status !== OutboxStatusEnum.PENDING) this.forgetSecrets(row);
    await this.dataSource.transaction(async (manager) => {
      // Failed for good: the credits it was charged go back.
      if (outcome.status === OutboxStatusEnum.FAILED && row.organization_id && row.credits_used > 0) {
        await this.smsCredits.refund(manager, row.organization_id, row.id);
        row.credits_used = 0;
      }
      await manager.save(row);
    });
    return row.status;
  }

  /** Removes a code from the row once it is no longer needed for sending. */
  private forgetSecrets(row: NotificationOutboxEntity): void {
    if (SENSITIVE_EVENTS.has(row.event_type)) row.payload = {};
  }
}
