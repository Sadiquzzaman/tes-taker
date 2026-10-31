import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { UserEntity } from 'src/user/entities/user.entity';
import { ListMessageLogQueryDto } from './dto/list-message-log-query.dto';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';

/** One message as the log shows it (FND-14). */
export interface MessageLogView {
  id: string;
  created_at: Date;
  sent_at: Date | null;
  event_type: string;
  channel: string;
  status: string;
  recipient: { id: string; full_name: string | null } | null;
  recipient_type: string;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  credits_used: number;
  attempts: number;
  error: string | null;
}

/** The organisation's message log (FND-14): every SMS and email it sent, newest first. */
@Injectable()
export class MessageLogService {
  constructor(
    @InjectRepository(NotificationOutboxEntity)
    private readonly outboxRepo: Repository<NotificationOutboxEntity>,
  ) {}

  async listForOrganization(query: ListMessageLogQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = tenantScoped(this.outboxRepo)
      .createQueryBuilder('o')
      .leftJoin(UserEntity, 'recipient', 'recipient.id = o.recipient_id')
      .addSelect(['recipient.id', 'recipient.full_name']);

    if (query.from) qb.andWhere('o.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('o.created_at < :to', { to: new Date(query.to) });
    if (query.recipient_id) qb.andWhere('o.recipient_id = :recipientId', { recipientId: query.recipient_id });
    if (query.event_type?.endsWith('.')) qb.andWhere('o.event_type LIKE :eventPrefix', { eventPrefix: `${query.event_type}%` });
    else if (query.event_type) qb.andWhere('o.event_type = :eventType', { eventType: query.event_type });
    if (query.channel) qb.andWhere('o.channel = :channel', { channel: query.channel });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });

    const total = await qb.clone().getCount();
    const { entities, raw } = await qb
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();

    const names = new Map<string, string | null>();
    for (const row of raw as Array<{ recipient_id: string | null; recipient_full_name: string | null }>) {
      if (row.recipient_id) names.set(row.recipient_id, row.recipient_full_name);
    }

    return {
      messages: entities.map((row): MessageLogView => ({
        id: row.id,
        created_at: row.created_at,
        sent_at: row.sent_at,
        event_type: row.event_type,
        channel: row.channel,
        status: row.status,
        recipient: row.recipient_id && names.has(row.recipient_id) ? { id: row.recipient_id, full_name: names.get(row.recipient_id) ?? null } : null,
        recipient_type: row.recipient_type,
        to_address: row.to_address,
        subject: row.subject,
        body: row.body,
        credits_used: row.credits_used,
        attempts: row.attempts,
        error: row.error,
      })),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1 },
    };
  }
}
