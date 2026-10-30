import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { DEFAULT_TEMPLATES } from './default-templates';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageTemplateEntity } from './entities/message-template.entity';
import { NotificationChannelEnum, NotificationLocale } from './notification.constants';

export interface ResolvedTemplate {
  subject: string | null;
  body: string;
}

/** The text for each event, channel and language (design §8.6). */
@Injectable()
export class MessageTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(MessageTemplatesService.name);

  constructor(
    @InjectRepository(MessageTemplateEntity)
    private readonly templateRepo: Repository<MessageTemplateEntity>,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seeding runs in the API process only; the worker boots at the same time (worker.ts).
    if (process.env.APP_ROLE === 'worker') return;
    await this.seedDefaults();
  }

  /**
   * Adds the platform default templates that do not exist yet. Existing rows are never changed,
   * so a platform admin's edits survive restarts (same rule as plan presets, design §8.3).
   */
  async seedDefaults(): Promise<void> {
    const result = await this.templateRepo
      .createQueryBuilder()
      .insert()
      .into(MessageTemplateEntity)
      .values(DEFAULT_TEMPLATES.map((t) => ({ ...t, organization_id: null })))
      .orIgnore()
      .returning(['id'])
      .execute();
    const created = (result.raw as unknown[] | undefined)?.length ?? 0;
    if (created) this.logger.log(`Message templates created: ${created}`);
  }

  /**
   * The organisation's own template, else the platform's, else the built-in default; English when
   * the language has none.
   */
  async resolve(
    eventType: string,
    channel: NotificationChannelEnum,
    locale: NotificationLocale,
    organizationId: string | null,
  ): Promise<ResolvedTemplate | null> {
    for (const lang of locale === 'en' ? ['en'] : [locale, 'en']) {
      const rows = await this.templateRepo.find({
        where: [
          ...(organizationId ? [{ organization_id: organizationId, event_type: eventType, channel, locale: lang }] : []),
          { organization_id: IsNull(), event_type: eventType, channel, locale: lang },
        ],
      });
      const row = rows.find((r) => r.organization_id !== null) ?? rows[0];
      if (row) return { subject: row.subject, body: row.body };
      const builtIn = DEFAULT_TEMPLATES.find((t) => t.event_type === eventType && t.channel === channel && t.locale === lang);
      if (builtIn) return { subject: builtIn.subject, body: builtIn.body };
    }
    return null;
  }

  /** Platform admin: every platform default, for the template editor. */
  listPlatform(): Promise<MessageTemplateEntity[]> {
    return this.templateRepo.find({
      where: { organization_id: IsNull() },
      order: { event_type: 'ASC', channel: 'ASC', locale: 'ASC' },
    });
  }

  /** Platform admin: change a default's subject or text (audited). */
  async updatePlatform(id: string, dto: UpdateMessageTemplateDto, actorId: string): Promise<MessageTemplateEntity> {
    const template = await this.templateRepo.findOne({ where: { id, organization_id: IsNull() } });
    if (!template) throw new NotFoundException('Message template not found');

    const before: Partial<MessageTemplateEntity> = {};
    const after: Partial<MessageTemplateEntity> = {};
    if (dto.body !== undefined && dto.body !== template.body) {
      before.body = template.body;
      after.body = dto.body;
      template.body = dto.body;
    }
    if (dto.subject !== undefined && dto.subject !== template.subject) {
      before.subject = template.subject;
      after.subject = dto.subject;
      template.subject = dto.subject;
    }
    if (Object.keys(after).length === 0) return template;

    template.updated_by = actorId;
    const saved = await this.templateRepo.save(template);
    this.audit.record({
      action: AUDIT_ACTIONS.MESSAGE_TEMPLATE_UPDATE,
      actorId,
      entityType: 'message_template',
      entityId: saved.id,
      before: { event_type: saved.event_type, channel: saved.channel, locale: saved.locale, ...before },
      after,
    });
    return saved;
  }
}
