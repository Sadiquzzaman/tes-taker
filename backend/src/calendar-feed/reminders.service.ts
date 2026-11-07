import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClassOccurrencesService } from 'src/attendance/class-occurrences.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { EventsService } from 'src/calendar/events.service';
import { RoutineSlotsService } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { ExamService } from 'src/exams/exam.service';
import { NOTIFICATION_EVENTS, NotificationChannelEnum } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { ReminderOffset, ReminderRuleEntity, ReminderTargetEnum } from './entities/reminder-rule.entity';

/** At most this many reminders per kind (CAL-05). */
export const MAX_REMINDERS = 5;
/** Reminders from 5 minutes to 1 day before. */
export const MIN_REMINDER_MINUTES = 5;
export const MAX_REMINDER_MINUTES = 1440;
/** The job looks this far back each run, so a late or missed run still sends (each reminder once). */
export const REMINDER_LOOKBACK_MS = 3 * 60_000;

/** Reminders an organisation has until an owner or admin sets its own: in the app, before every class, exam and event. */
export const BUILT_IN_REMINDERS: Record<ReminderTargetEnum, ReminderOffset[]> = {
  CLASS: [{ minutes: 30, channel: 'IN_APP' }],
  EXAM: [{ minutes: 60, channel: 'IN_APP' }],
  EVENT: [{ minutes: 60, channel: 'IN_APP' }],
};

const TARGETS = Object.values(ReminderTargetEnum);
const { OWNER, ADMIN } = OrganizationMemberRoleEnum;

/** `GET /reminders`: the organisation's defaults and the caller's own reminders per kind. */
export interface ReminderSettingsView {
  defaults: Record<ReminderTargetEnum, ReminderOffset[]>;
  mine: Record<ReminderTargetEnum, { offsets: ReminderOffset[]; own: boolean }>;
  /** Owners and admins change the defaults. */
  can_manage: boolean;
}

/** Something to remind people of: when it starts and who is told. */
interface Occurrence {
  target: ReminderTargetEnum;
  id: string;
  title: string;
  starts_at: Date;
  place: string | null;
  user_ids: string[];
}

/**
 * Reminders before classes, exams and events (CAL-05, design §7 `calendar.reminders`): up to 5
 * per kind, each a time before the start (5 minutes to a day) and a channel (in the app, or SMS
 * on the organisation's credits). Owners and admins set the organisation's defaults; each person
 * can set their own or switch a kind off. The job runs every minute and sends each reminder once
 * (dedupe key per kind, occurrence, time, person and channel).
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(ReminderRuleEntity)
    private readonly ruleRepo: Repository<ReminderRuleEntity>,
    private readonly classes: ClassOccurrencesService,
    private readonly slots: RoutineSlotsService,
    private readonly events: EventsService,
    private readonly exams: ExamService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementsService,
    private readonly audit: AuditService,
  ) {}

  async settings(tenant: Tenant, userId: string): Promise<ReminderSettingsView> {
    const rules = await this.ruleRepo.find({ where: [{ organization_id: tenant.organizationId, user_id: IsNull() }, { organization_id: tenant.organizationId, user_id: userId }] });
    const defaults = defaultsOf(rules);
    const mine = Object.fromEntries(
      TARGETS.map((target) => {
        const own = rules.find((rule) => rule.user_id === userId && rule.target === target);
        return [target, { offsets: own ? own.offsets : defaults[target], own: Boolean(own) }];
      }),
    ) as ReminderSettingsView['mine'];
    return { defaults, mine, can_manage: isManager(tenant) };
  }

  /** The organisation's default reminders for a kind (owners and admins). */
  async saveDefaults(tenant: Tenant, userId: string, target: ReminderTargetEnum, offsets: ReminderOffset[]): Promise<ReminderSettingsView> {
    if (!isManager(tenant)) throw new ForbiddenException('Only owners and admins change the default reminders');
    const wanted = normalise(offsets);
    const before = (await this.ruleRepo.findOne({ where: { organization_id: tenant.organizationId, user_id: IsNull(), target } }))?.offsets ?? BUILT_IN_REMINDERS[target];
    await this.upsert(tenant.organizationId, null, target, wanted, userId);
    this.audit.record({
      action: AUDIT_ACTIONS.REMINDERS_DEFAULTS_UPDATE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'reminder_rule',
      entityId: tenant.organizationId,
      before: { target, offsets: before },
      after: { target, offsets: wanted },
    });
    return this.settings(tenant, userId);
  }

  /** The caller's own reminders for a kind; an empty list switches that kind off for them. */
  async saveMine(tenant: Tenant, userId: string, target: ReminderTargetEnum, offsets: ReminderOffset[]): Promise<ReminderSettingsView> {
    await this.upsert(tenant.organizationId, userId, target, normalise(offsets), userId);
    return this.settings(tenant, userId);
  }

  /** Back to the organisation's default for a kind. */
  async resetMine(tenant: Tenant, userId: string, target: ReminderTargetEnum): Promise<ReminderSettingsView> {
    await this.ruleRepo.delete({ organization_id: tenant.organizationId, user_id: userId, target });
    return this.settings(tenant, userId);
  }

  /**
   * Sends the reminders due from `now - 3 minutes` to `now`, for every organisation with the
   * calendar feature that has classes, events or exams coming. Returns how many were queued.
   */
  async sweep(now = new Date()): Promise<{ organizations: number; reminders: number }> {
    const since = new Date(now.getTime() - REMINDER_LOOKBACK_MS);
    const horizon = new Date(now.getTime() + MAX_REMINDER_MINUTES * 60_000);
    const organizationIds = new Set([
      ...(await this.slots.organizationsWithActiveSlots()),
      ...(await this.events.organizationsWithEvents(since, horizon)),
      ...(await this.organizationsWithExams(since, horizon)),
    ]);
    let organizations = 0;
    let reminders = 0;
    for (const organizationId of organizationIds) {
      try {
        if (!(await this.entitlements.hasFeature(organizationId, FeatureKey.CALENDAR))) continue;
        organizations++;
        reminders += await this.sweepOrganization(organizationId, now, since);
      } catch (error) {
        this.logger.error(`Reminders for organisation ${organizationId} failed: ${(error as Error).message}`);
      }
    }
    return { organizations, reminders };
  }

  private async sweepOrganization(organizationId: string, now: Date, since: Date): Promise<number> {
    const rules = await this.ruleRepo.find({ where: { organization_id: organizationId } });
    const defaults = defaultsOf(rules);
    const own = new Map(rules.filter((rule) => rule.user_id).map((rule) => [`${rule.user_id}|${rule.target}`, rule.offsets]));
    const longest = Math.max(0, ...rules.flatMap((rule) => rule.offsets.map((offset) => offset.minutes)), ...TARGETS.flatMap((target) => defaults[target].map((offset) => offset.minutes)));
    if (longest === 0) return 0;
    // Things starting soon enough that one of their reminders falls in (since, now].
    const from = new Date(since.getTime());
    const to = new Date(now.getTime() + longest * 60_000);
    const occurrences: Occurrence[] = [
      ...(await this.classes.startingBetween(organizationId, from, to)).map((lesson) => ({
        target: ReminderTargetEnum.CLASS,
        id: lesson.id,
        title: lesson.section_label,
        starts_at: lesson.starts_at,
        place: null,
        user_ids: [], // filled below: the section's students and that day's teacher
        section_id: lesson.section_id,
        teacher_id: lesson.teacher_id,
      })),
      ...(await this.exams.reminderExams(organizationId, from, to)).map((exam) => ({
        target: ReminderTargetEnum.EXAM,
        id: exam.id,
        title: exam.title,
        starts_at: exam.starts_at,
        place: null,
        user_ids: exam.student_ids,
      })),
      ...(await this.events.startingBetween(organizationId, from, to)).map((event) => ({
        target: ReminderTargetEnum.EVENT,
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        place: event.place,
        user_ids: event.user_ids,
      })),
    ];
    await this.fillClassPeople(organizationId, occurrences as (Occurrence & { section_id?: string; teacher_id?: string | null })[]);

    const organizationName = (await this.ruleRepo.manager.getRepository(OrganizationEntity).findOne({ where: { id: organizationId }, select: ['id', 'name'] }))?.name ?? '';
    let sent = 0;
    for (const occurrence of occurrences) {
      // Who gets which reminder of this occurrence now: by time and channel.
      const due = new Map<string, { minutes: number; channel: ReminderOffset['channel']; userIds: string[] }>();
      for (const userId of occurrence.user_ids) {
        const offsets = own.get(`${userId}|${occurrence.target}`) ?? defaults[occurrence.target];
        for (const offset of offsets) {
          const fireAt = occurrence.starts_at.getTime() - offset.minutes * 60_000;
          if (fireAt <= since.getTime() || fireAt > now.getTime()) continue;
          const group = due.get(`${offset.minutes}|${offset.channel}`) ?? { minutes: offset.minutes, channel: offset.channel, userIds: [] };
          group.userIds.push(userId);
          due.set(`${offset.minutes}|${offset.channel}`, group);
        }
      }
      const variables = { title: occurrence.title, starts_at: occurrence.starts_at.toISOString(), place: occurrence.place ?? '', organization_name: organizationName, path: '/calendar' };
      for (const group of due.values()) {
        const key = `reminder:${occurrence.target}:${occurrence.id}:${group.minutes}`;
        if (group.channel === 'SMS') {
          await this.notifications.enqueue(
            group.userIds.map((userId) => ({
              eventType: NOTIFICATION_EVENTS.CALENDAR_REMINDER,
              channel: NotificationChannelEnum.SMS,
              organizationId,
              userId,
              variables,
              dedupeKey: `${key}:${userId}:SMS`,
            })),
          );
        } else {
          await this.notifications.notifyUsers({ eventType: NOTIFICATION_EVENTS.CALENDAR_REMINDER, organizationId, userIds: group.userIds, variables, dedupeKey: key });
        }
        sent += group.userIds.length;
      }
    }
    return sent;
  }

  /** A class's people: the section's active students and the teacher who takes it that day. */
  private async fillClassPeople(organizationId: string, occurrences: (Occurrence & { section_id?: string; teacher_id?: string | null })[]): Promise<void> {
    const classes = occurrences.filter((occurrence) => occurrence.target === ReminderTargetEnum.CLASS);
    if (classes.length === 0) return;
    const sectionIds = [...new Set(classes.map((lesson) => lesson.section_id as string))];
    const students = await this.classes.studentsOf(organizationId, sectionIds);
    for (const lesson of classes) {
      lesson.user_ids = [...new Set([...(students.get(lesson.section_id as string) ?? []), ...(lesson.teacher_id ? [lesson.teacher_id] : [])])];
    }
  }

  private async organizationsWithExams(from: Date, to: Date): Promise<string[]> {
    const rows: { organization_id: string }[] = await this.ruleRepo.manager.query(
      `SELECT DISTINCT organization_id FROM exams WHERE organization_id IS NOT NULL AND exam_start_time > $1 AND exam_start_time <= $2`,
      [from, to],
    );
    return rows.map((row) => row.organization_id);
  }

  private async upsert(organizationId: string, userId: string | null, target: ReminderTargetEnum, offsets: ReminderOffset[], actorId: string): Promise<void> {
    const where = { organization_id: organizationId, user_id: userId ?? IsNull(), target };
    const existing = await this.ruleRepo.findOne({ where });
    if (existing) await this.ruleRepo.update({ id: existing.id }, { offsets, updated_by: actorId });
    else await this.ruleRepo.insert({ organization_id: organizationId, user_id: userId, target, offsets, updated_by: actorId });
  }
}

const isManager = (tenant: Tenant) => !tenant.viaEnrolment && [OWNER, ADMIN].includes(tenant.memberRole);

/** The organisation's defaults per kind: its own rule, else the built-in reminders. */
function defaultsOf(rules: ReminderRuleEntity[]): Record<ReminderTargetEnum, ReminderOffset[]> {
  return Object.fromEntries(
    TARGETS.map((target) => [target, rules.find((rule) => !rule.user_id && rule.target === target)?.offsets ?? BUILT_IN_REMINDERS[target]]),
  ) as Record<ReminderTargetEnum, ReminderOffset[]>;
}

/** At most 5, whole minutes from 5 to 1440, no time twice, in the app or by SMS; sorted earliest first. */
function normalise(offsets: ReminderOffset[]): ReminderOffset[] {
  const invalid = () => new BadRequestException({ message: `Up to ${MAX_REMINDERS} reminders, ${MIN_REMINDER_MINUTES} minutes to a day before, each time once`, code: 'REMINDER_INVALID' });
  if (!Array.isArray(offsets) || offsets.length > MAX_REMINDERS) throw invalid();
  const seen = new Set<number>();
  for (const offset of offsets) {
    if (!Number.isInteger(offset.minutes) || offset.minutes < MIN_REMINDER_MINUTES || offset.minutes > MAX_REMINDER_MINUTES) throw invalid();
    if (offset.channel !== 'IN_APP' && offset.channel !== 'SMS') throw invalid();
    if (seen.has(offset.minutes)) throw invalid();
    seen.add(offset.minutes);
  }
  return offsets.map((offset) => ({ minutes: offset.minutes, channel: offset.channel })).sort((a, b) => b.minutes - a.minutes);
}
