import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { NOTIFICATIONS_DISPATCH_JOB, NOTIFICATIONS_QUEUE } from 'src/queue/queue.constants';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import {
  NotificationChannelEnum,
  NotificationEvent,
  NotificationLocale,
  OutboxStatusEnum,
  RecipientTypeEnum,
} from './notification.constants';

/** One message for `NotificationsService.enqueue`. */
export interface OutboxMessage {
  /** What happened, e.g. `exam.scheduled` (NOTIFICATION_EVENTS). Picks the template. */
  eventType: NotificationEvent;
  channel: NotificationChannelEnum;
  /** The organisation that pays for SMS and sees the message log; null for platform messages. */
  organizationId: string | null;
  /** A user: their phone/email and language are read when the message is sent. */
  userId?: string;
  /**
   * Or a phone/email directly (no account yet, or a guardian). For a guardian also pass
   * `recipientType: GUARDIAN` and their id as `recipientId`, so the log can find them.
   */
  address?: string;
  recipientType?: RecipientTypeEnum;
  recipientId?: string;
  /** bn | en. Default: the user's language, then the organisation's, then English. */
  locale?: NotificationLocale;
  /** Template variables. Names ending in `_at` are dates (ISO strings). */
  variables?: Record<string, unknown>;
  /** A second message with the same key is ignored (safe retries, e.g. `absence:{student}:{date}`). */
  dedupeKey?: string;
  /** Not before this time. */
  sendAfter?: Date;
  /** Ahead of other waiting messages (sign-up codes). */
  urgent?: boolean;
  /** Who caused it (the signed-in user), for the log. */
  createdBy?: string | null;
}

/**
 * The one way to send SMS and email (design §8.6, CLAUDE.md): write an outbox row, the worker sends
 * it. Pass the transaction's EntityManager so the row commits (or rolls back) with your change:
 *
 *   await this.dataSource.transaction(async (manager) => {
 *     await manager.save(attendance);
 *     await this.notifications.enqueue({
 *       eventType: NOTIFICATION_EVENTS.ATTENDANCE_ABSENT, channel: NotificationChannelEnum.SMS,
 *       organizationId, address: guardian.phone, recipientType: RecipientTypeEnum.GUARDIAN,
 *       recipientId: guardian.id, variables: { student_name, date }, dedupeKey: `absent:${id}:${date}`,
 *     }, manager);
 *   });
 *
 * Sending, retries, credits and the message log are the worker's job; enqueue never fails because
 * a provider is down. Rows are picked up by a job right away and by a sweep every 30 s.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly outboxRepo: Repository<NotificationOutboxEntity>,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue,
  ) {}

  /** Queues the messages and returns the ids of the new rows (duplicates by `dedupeKey` are skipped). */
  async enqueue(messages: OutboxMessage | OutboxMessage[], manager?: EntityManager): Promise<string[]> {
    const list = (Array.isArray(messages) ? messages : [messages]).filter((m) => this.hasRecipient(m));
    if (list.length === 0) return [];

    const rows = list.map((m) => this.toRow(m));
    const insert = (manager ?? this.outboxRepo.manager)
      .createQueryBuilder()
      .insert()
      .into(NotificationOutboxEntity)
      .values(rows)
      .orIgnore()
      .returning(['id', 'urgent', 'send_after']);
    const result = await insert.execute();
    const inserted = (result.raw as Array<{ id: string; urgent: boolean; send_after: Date | null }>) ?? [];

    // Inside a transaction the row may not be committed yet: wait a moment (the sweep covers a long one).
    const baseDelay = manager?.queryRunner?.isTransactionActive ? 2_000 : 0;
    await this.queueJobs(inserted, baseDelay);
    return inserted.map((row) => row.id);
  }

  private hasRecipient(message: OutboxMessage): boolean {
    if (message.userId || message.address?.trim()) return true;
    this.logger.warn(`Message ${message.eventType} (${message.channel}) has no recipient; not queued`);
    return false;
  }

  private toRow(message: OutboxMessage): QueryDeepPartialEntity<NotificationOutboxEntity> {
    const recipientType = message.recipientType ?? (message.userId ? RecipientTypeEnum.USER : RecipientTypeEnum.ADDRESS);
    return {
      organization_id: message.organizationId,
      event_type: message.eventType,
      channel: message.channel,
      recipient_type: recipientType,
      recipient_id: message.recipientId ?? message.userId ?? null,
      to_address: message.address?.trim() || null,
      locale: message.locale ?? null,
      // A bound jsonb parameter (QueryDeepPartialEntity does not model free-form objects).
      payload: (message.variables ?? {}) as QueryDeepPartialEntity<Record<string, unknown>>,
      dedupe_key: message.dedupeKey ?? null,
      status: OutboxStatusEnum.PENDING,
      urgent: Boolean(message.urgent),
      send_after: message.sendAfter ?? null,
      created_by: message.createdBy ?? null,
    };
  }

  private async queueJobs(rows: Array<{ id: string; urgent: boolean; send_after: Date | null }>, baseDelay: number): Promise<void> {
    if (rows.length === 0) return;
    try {
      await this.queue.addBulk(
        rows.map((row) => ({
          name: NOTIFICATIONS_DISPATCH_JOB,
          data: { outboxId: row.id },
          opts: {
            jobId: row.id,
            delay: Math.max(baseDelay, row.send_after ? new Date(row.send_after).getTime() - Date.now() : 0),
            // Lower number = sooner; urgent rows (sign-up codes) go before a big exam announcement.
            priority: row.urgent ? 1 : 10,
          },
        })),
      );
    } catch (error) {
      // The rows are saved; the sweep sends them.
      this.logger.error(`Could not queue ${rows.length} notification job(s): ${(error as Error).message}`);
    }
  }
}
