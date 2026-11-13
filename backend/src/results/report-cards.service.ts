import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { GuardiansService } from 'src/academics/guardians.service';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { resolveFrontendUrl } from 'src/common/utils/frontend-url.util';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, RecipientTypeEnum } from 'src/notifications/notification.constants';
import { NotificationsService, OutboxMessage } from 'src/notifications/notifications.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { GenerateReportCardsDto, ShareReportCardsDto } from './dto/report-card.dto';
import { ReportCardEntity } from './entities/report-card.entity';
import { RESULTS_ERRORS } from './results-errors';
import { ScoresService, SectionPage } from './scores.service';

const { OWNER, ADMIN, STUDENT } = OrganizationMemberRoleEnum;
/** Who writes the principal's remark. */
const PRINCIPALS = [OWNER, ADMIN];

/** What a card shows, frozen when it is made. */
export interface ReportCardSnapshot {
  organization: { name: string };
  page: Omit<SectionPage, 'exams' | 'homework_items' | 'at_risk'>;
  /** The position is printed only when the organisation shows positions (PRF-10). */
  show_position: boolean;
}

export interface ReportCardView {
  id: string;
  version: number;
  locale: 'bn' | 'en';
  term: { id: string; name: string } | null;
  teacher_remark: string | null;
  principal_remark: string | null;
  generated_at: Date;
  shared_at: Date | null;
  share_expires_at: Date | null;
  snapshot: ReportCardSnapshot;
}

export interface ReportCardList {
  section: { id: string; name: string; class_name: string; session: { id: string; name: string; closed: boolean } };
  term: { id: string; name: string } | null;
  can_write_principal_remark: boolean;
  rows: { student: { id: string; full_name: string; roll_no: string | null }; latest: Omit<ReportCardView, 'snapshot'> | null }[];
}

type Actor = { id: string };

const NO_TERM = '00000000-0000-0000-0000-000000000000';
/** How long a guardian link works (PRF-09). */
export const SHARE_DAYS = 30;
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Report cards (P7-04, PRF-09): staff who see a section make the cards of its students for a term
 * (or the whole session) in Bangla or English, with the teacher's remark and, from owners and
 * admins, the principal's. A card freezes the scores as they are (`scores_snapshot`, design
 * decision 22 Oct); making it again after a change adds a version and keeps the earlier ones.
 * Unchanged cards are not made again. Students see their own latest cards.
 */
@Injectable()
export class ReportCardsService {
  constructor(
    @InjectRepository(ReportCardEntity)
    private readonly cardRepo: Repository<ReportCardEntity>,
    private readonly dataSource: DataSource,
    private readonly scores: ScoresService,
    private readonly orgSettings: OrgSettingsService,
    private readonly audit: AuditService,
    private readonly guardians: GuardiansService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Every student of the section with their latest card for the term. */
  async list(tenant: Tenant, userId: string, sectionId: string, termId?: string): Promise<ReportCardList> {
    this.scores.staffOnly(tenant);
    const section = await this.scores.staffSection(tenant, userId, sectionId);
    const scores = await this.scores.compute(tenant.organizationId, sectionId, termId, false);
    const latest = await this.latestCards(tenant.organizationId, sectionId, termId ?? null);
    const session = { id: section.session_id, name: section.session?.name ?? '', closed: section.session?.status === AcademicSessionStatusEnum.CLOSED };
    return {
      section: { id: scores.section.id, name: scores.section.name, class_name: scores.section.class_name, session },
      term: scores.period.term,
      can_write_principal_remark: PRINCIPALS.includes(tenant.memberRole),
      rows: scores.students.map((s) => {
        const card = latest.get(s.student.id);
        return { student: s.student, latest: card ? this.summary(card) : null };
      }),
    };
  }

  /**
   * Makes the cards of the given students. A card that would be the same as the latest (same
   * scores, remarks and language) is not made again. Teachers' principal remarks are ignored.
   */
  async generate(tenant: Tenant, actor: Actor, dto: GenerateReportCardsDto): Promise<ReportCardList> {
    this.scores.staffOnly(tenant);
    const section = await this.scores.staffSection(tenant, actor.id, dto.section_id);
    const organizationId = tenant.organizationId;
    const ids = [...new Set(dto.rows.map((r) => r.student_id))];
    const { pages, show_rank } = await this.scores.pages(organizationId, section.id, dto.term_id, false);
    const unknown = ids.findIndex((id) => !pages.has(id));
    if (unknown >= 0) {
      throw new BadRequestException({ message: 'Not a student of this section', code: RESULTS_ERRORS.CARD_STUDENT_UNKNOWN, details: { index: dto.rows.findIndex((r) => r.student_id === ids[unknown]) } });
    }
    const organization = { name: await this.orgSettings.organizationName(organizationId) };
    const principal = PRINCIPALS.includes(tenant.memberRole);
    const termId = dto.term_id ?? null;
    const made: ReportCardEntity[] = [];

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ReportCardEntity);
      // One maker at a time per section and term, so versions never clash.
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`report_cards:${section.id}:${termId ?? NO_TERM}`]);
      const latest = await this.latestCards(organizationId, section.id, termId, manager.getRepository(ReportCardEntity));
      for (const row of dto.rows) {
        const page = pages.get(row.student_id)!;
        const previous = latest.get(row.student_id);
        const { exams: _exams, homework_items: _items, at_risk: _risk, ...kept } = page;
        const snapshot: ReportCardSnapshot = { organization, page: kept, show_position: show_rank };
        const teacherRemark = row.teacher_remark === undefined ? (previous?.teacher_remark ?? null) : row.teacher_remark?.trim() || null;
        const principalRemark = principal && row.principal_remark !== undefined ? row.principal_remark?.trim() || null : (previous?.principal_remark ?? null);
        if (
          previous &&
          previous.locale === dto.locale &&
          previous.teacher_remark === teacherRemark &&
          previous.principal_remark === principalRemark &&
          sameJson(previous.scores_snapshot, snapshot)
        ) {
          continue;
        }
        made.push(
          await repo.save(
            repo.create({
              organization_id: organizationId,
              session_id: section.session_id,
              term_id: termId,
              section_id: section.id,
              student_id: row.student_id,
              version: (previous?.version ?? 0) + 1,
              locale: dto.locale,
              teacher_remark: teacherRemark,
              principal_remark: principalRemark,
              scores_snapshot: snapshot as unknown as Record<string, unknown>,
              generated_by: actor.id,
            }),
          ),
        );
      }
    });
    if (made.length) {
      this.audit.recordMany(
        made.map((card) => ({
          action: AUDIT_ACTIONS.REPORT_CARD_GENERATE,
          organizationId,
          actorId: actor.id,
          entityType: 'report_card',
          entityId: card.id,
          after: { student_id: card.student_id, term_id: card.term_id, version: card.version, locale: card.locale, score_pct: (card.scores_snapshot as unknown as ReportCardSnapshot).page.overall.score_pct },
        })),
      );
    }
    return this.list(tenant, actor.id, section.id, dto.term_id);
  }

  /** The latest cards of a section for a term, to print them all at once. */
  async printable(tenant: Tenant, userId: string, sectionId: string, termId?: string): Promise<ReportCardView[]> {
    this.scores.staffOnly(tenant);
    await this.scores.staffSection(tenant, userId, sectionId);
    const latest = await this.latestCards(tenant.organizationId, sectionId, termId ?? null);
    return [...latest.values()].map((card) => this.view(card)).sort((a, b) => order(a) - order(b) || a.snapshot.page.student.full_name.localeCompare(b.snapshot.page.student.full_name));
  }

  /** One card: for staff who see its section, or the student it belongs to. */
  async one(tenant: Tenant, userId: string, id: string): Promise<ReportCardView> {
    const card = await this.cardRepo.findOne({ where: { id, organization_id: tenant.organizationId } });
    if (!card) throw new NotFoundException({ message: 'Report card not found', code: RESULTS_ERRORS.NOT_FOUND });
    if (tenant.memberRole === STUDENT || tenant.viaEnrolment) {
      if (card.student_id !== userId) throw new NotFoundException({ message: 'Report card not found', code: RESULTS_ERRORS.NOT_FOUND });
    } else {
      this.scores.staffOnly(tenant);
      await this.scores.staffSection(tenant, userId, card.section_id);
    }
    return this.view(card);
  }

  /** A student's own cards: the latest of each section and term, newest first. */
  async mine(tenant: Tenant, userId: string): Promise<Omit<ReportCardView, 'snapshot'>[]> {
    if (!(tenant.memberRole === STUDENT || tenant.viaEnrolment)) throw new ForbiddenException({ message: 'Only students have their own report cards', code: RESULTS_ERRORS.NOT_ALLOWED });
    const cards = await this.cardRepo
      .createQueryBuilder('c')
      .distinctOn(['c.section_id', 'c.term_id'])
      .where('c.organization_id = :organizationId AND c.student_id = :userId', { organizationId: tenant.organizationId, userId })
      .orderBy('c.section_id')
      .addOrderBy('c.term_id')
      .addOrderBy('c.version', 'DESC')
      .getMany();
    return cards.sort((a, b) => b.generated_at.getTime() - a.generated_at.getTime()).map((card) => this.summary(card));
  }

  /**
   * Shares the latest cards of a section and term with the students' guardians (PRF-09): each card
   * gets a new link that needs no login and works for 30 days (sharing again replaces it; only a
   * hash is kept), and each guardian with a phone gets an SMS with a short summary and the link,
   * through the outbox (on the organisation's SMS credits). Staff who see the section.
   */
  async share(tenant: Tenant, actor: Actor, dto: ShareReportCardsDto): Promise<{ cards: number; guardian_sms: number; links: { student_id: string; url: string }[] }> {
    this.scores.staffOnly(tenant);
    const section = await this.scores.staffSection(tenant, actor.id, dto.section_id);
    const organizationId = tenant.organizationId;
    const latest = [...(await this.latestCards(organizationId, section.id, dto.term_id ?? null)).values()].filter(
      (card) => !dto.student_ids || dto.student_ids.includes(card.student_id),
    );
    const organizationName = await this.orgSettings.organizationName(organizationId);
    const base = resolveFrontendUrl(this.config);
    const now = new Date();
    const expires = new Date(now.getTime() + SHARE_DAYS * 24 * 60 * 60 * 1000);
    const links: { student_id: string; url: string }[] = [];
    let sms = 0;
    for (const card of latest) {
      const token = randomBytes(18).toString('base64url');
      await this.cardRepo.update({ id: card.id }, { share_token_hash: hashOf(token), share_expires_at: expires, shared_at: now, shared_by: actor.id });
      const url = `${base}/r/${token}`;
      links.push({ student_id: card.student_id, url });
      const snapshot = card.scores_snapshot as unknown as ReportCardSnapshot;
      const overall = snapshot.page.overall;
      const contacts = await this.guardians.contactsForStudent(organizationId, card.student_id);
      const ids = await this.notifications.enqueue(
        contacts.map(
          (guardian): OutboxMessage => ({
            eventType: NOTIFICATION_EVENTS.REPORT_CARD_SHARED,
            channel: NotificationChannelEnum.SMS,
            organizationId,
            address: guardian.phone,
            recipientType: RecipientTypeEnum.GUARDIAN,
            recipientId: guardian.id,
            locale: guardian.locale,
            variables: {
              student_id: card.student_id,
              student_name: snapshot.page.student.full_name,
              term: snapshot.page.period.term?.name ?? snapshot.page.section.session.name,
              score: overall.score_pct === null ? '-' : `${overall.score_pct}%${overall.grade ? ` (${overall.grade.grade})` : ''}`,
              link: url,
              organization_name: organizationName,
            },
            dedupeKey: `${NOTIFICATION_EVENTS.REPORT_CARD_SHARED}:${card.id}:${guardian.id}:${now.toISOString()}`,
            createdBy: actor.id,
          }),
        ),
      );
      sms += ids.length;
    }
    if (latest.length) {
      this.audit.recordMany(
        latest.map((card) => ({
          action: AUDIT_ACTIONS.REPORT_CARD_SHARE,
          organizationId,
          actorId: actor.id,
          entityType: 'report_card',
          entityId: card.id,
          after: { student_id: card.student_id, version: card.version, expires_at: expires.toISOString() },
        })),
      );
    }
    return { cards: latest.length, guardian_sms: sms, links };
  }

  /** A shared card by its link, for a guardian without an account (404 when unknown or expired). */
  async byLink(token: string): Promise<ReportCardView> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new NotFoundException({ message: 'This link is not valid', code: RESULTS_ERRORS.NOT_FOUND });
    const card = await this.cardRepo.findOne({ where: { share_token_hash: hashOf(token), share_expires_at: MoreThan(new Date()) } });
    if (!card) throw new NotFoundException({ message: 'This link has expired or is not valid', code: RESULTS_ERRORS.NOT_FOUND });
    return this.view(card);
  }

  // ------------------------------------------------------------------ helpers

  private async latestCards(organizationId: string, sectionId: string, termId: string | null, repo = this.cardRepo): Promise<Map<string, ReportCardEntity>> {
    const cards = await repo
      .createQueryBuilder('c')
      .distinctOn(['c.student_id'])
      .where('c.organization_id = :organizationId AND c.section_id = :sectionId', { organizationId, sectionId })
      .andWhere(termId ? 'c.term_id = :termId' : 'c.term_id IS NULL', { termId })
      .orderBy('c.student_id')
      .addOrderBy('c.version', 'DESC')
      .getMany();
    return new Map(cards.map((card) => [card.student_id, card]));
  }

  private summary(card: ReportCardEntity): Omit<ReportCardView, 'snapshot'> {
    const snapshot = card.scores_snapshot as unknown as ReportCardSnapshot;
    return {
      id: card.id,
      version: card.version,
      locale: card.locale,
      term: snapshot.page.period.term,
      teacher_remark: card.teacher_remark,
      principal_remark: card.principal_remark,
      generated_at: card.generated_at,
      shared_at: card.shared_at,
      share_expires_at: card.share_expires_at,
    };
  }

  private view(card: ReportCardEntity): ReportCardView {
    const snapshot = card.scores_snapshot as unknown as ReportCardSnapshot;
    return { ...this.summary(card), snapshot: { ...snapshot, page: { ...snapshot.page, position: snapshot.show_position ? snapshot.page.position : null } } };
  }
}

/** Equal as stored JSON: whatever the key order (jsonb keeps its own) and with undefined fields left out. */
export const sameJson = (a: unknown, b: unknown): boolean => stable(a) === stable(b);
const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : value !== null && typeof value === 'object'
      ? `{${Object.keys(value)
          .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
          .join(',')}}`
      : JSON.stringify(value ?? null);

/** Roll order: numbers first, by number. */
const order = (card: ReportCardView) => {
  const roll = Number(card.snapshot.page.student.roll_no);
  return Number.isFinite(roll) && card.snapshot.page.student.roll_no !== null ? roll : Number.MAX_SAFE_INTEGER;
};
