import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { CalendarStatus, MyAttendanceService } from 'src/attendance/my-attendance.service';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { EventStatusEnum, EventTypeEnum } from 'src/calendar/entities/event.entity';
import { EventsService } from 'src/calendar/events.service';
import { RoutineService } from 'src/calendar/routine.service';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { addDays, daysBetween, DEFAULT_TIME_ZONE, schoolDateIn, zonedInstant } from 'src/common/utils/school-date.util';
import { ExamService } from 'src/exams/exam.service';
import { HomeworkService } from 'src/homework/homework.service';
import { StudentExamService } from 'src/exams/student-exam.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserContextService } from 'src/organizations/user-context.service';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { CalendarFeedTokenEntity } from './entities/calendar-feed-token.entity';
import { icalCalendar, IcalEvent } from './ical';

const { STUDENT } = OrganizationMemberRoleEnum;
/** Longest range `GET /calendar/feed` returns, in days. */
export const MAX_FEED_DAYS = 62;
/** The subscription link covers this many days back and ahead. */
export const ICAL_DAYS_BACK = 30;
export const ICAL_DAYS_AHEAD = 90;

/** The workspace an item of the personal calendar comes from ("My Teaching", a school's name). */
export interface FeedWorkspace {
  key: string;
  label: string;
}

/** One thing on the calendar (CAL-07). Times are instants; a class also has its school date. */
export type FeedItem = (

  | {
      kind: 'CLASS';
      id: string;
      date: string;
      starts_at: Date;
      ends_at: Date;
      title: string;
      section: { id: string; name: string; class_name: string };
      subject: string | null;
      teacher: string | null;
      room: string | null;
      role: string;
      /** The class's status that day (as on My attendance): CANCELLED when it was cancelled. */
      status: CalendarStatus;
    }
  | { kind: 'EVENT'; id: string; starts_at: Date; ends_at: Date; title: string; event_type: EventTypeEnum; place: string | null; cancelled: boolean }
  | { kind: 'EXAM'; id: string; starts_at: Date; ends_at: Date; title: string; class_name: string | null }
  | { kind: 'HOLIDAY'; id: string; date: string; title: string | null; reason: 'WEEKLY_OFF' | 'HOLIDAY' }
  /** Homework due: `starts_at` and `ends_at` are both the due time. `handed_in` is for students (null for staff). */
  | { kind: 'HOMEWORK'; id: string; starts_at: Date; ends_at: Date; title: string; subject: string; sections: string[]; handed_in: boolean | null }
) & { workspace?: FeedWorkspace };

export interface CalendarFeed {
  from: string;
  to: string;
  time_zone: string;
  items: FeedItem[];
}

/**
 * The person's calendar (CAL-07): their classes from the routine with that day's changes and
 * cancellations (as on My attendance), the events they attend, their exams, and closed days, in
 * one list; and a private subscription link (iCal) for Google or Apple Calendar. Only a SHA-256
 * of the link's token is kept; a new link revokes the old one.
 */
@Injectable()
export class CalendarFeedService {
  constructor(
    @InjectRepository(CalendarFeedTokenEntity)
    private readonly tokenRepo: Repository<CalendarFeedTokenEntity>,
    private readonly myAttendance: MyAttendanceService,
    private readonly routine: RoutineService,
    private readonly events: EventsService,
    private readonly exams: ExamService,
    private readonly studentExams: StudentExamService,
    private readonly orgSettings: OrgSettingsService,
    private readonly access: OrganizationAccessService,
    private readonly entitlements: EntitlementsService,
    private readonly homework: HomeworkService,
    private readonly contexts: UserContextService,
  ) {}

  /** `GET /calendar/feed?from=&to=` (school dates, at most 62 days). */
  async feed(tenant: Tenant, userId: string, from: string, to: string): Promise<CalendarFeed> {
    if (to < from || daysBetween(from, to) > MAX_FEED_DAYS) {
      throw new BadRequestException({ message: `Choose at most ${MAX_FEED_DAYS} days`, code: 'CALENDAR_RANGE_INVALID' });
    }
    return this.between(tenant, userId, from, to);
  }

  /**
   * `GET /calendar/me?from=&to=`: the person's own calendar across every workspace they belong to
   * (their teaching workspace, schools, solo teachers' classes) that has the calendar, each item
   * marked with its workspace. Times are instants; `time_zone` is the first workspace's.
   */
  async personal(userId: string, from: string, to: string): Promise<CalendarFeed & { workspaces: FeedWorkspace[] }> {
    if (to < from || daysBetween(from, to) > MAX_FEED_DAYS) {
      throw new BadRequestException({ message: `Choose at most ${MAX_FEED_DAYS} days`, code: 'CALENDAR_RANGE_INVALID' });
    }
    return this.personalBetween(userId, from, to);
  }

  /** The personal calendar for any range (the iCal link asks for 120 days). */
  private async personalBetween(userId: string, from: string, to: string): Promise<CalendarFeed & { workspaces: FeedWorkspace[] }> {
    const items: FeedItem[] = [];
    const workspaces: FeedWorkspace[] = [];
    let timeZone: string | null = null;
    for (const { key, label, tenant } of await this.contexts.workspaces(userId)) {
      if (!(await this.entitlements.hasFeature(tenant.organizationId, FeatureKey.CALENDAR))) continue;
      // The feed's services read the request's workspace, so each workspace runs in its own.
      const feed = await TenantContext.run(() => {
        TenantContext.set(tenant);
        return this.between(tenant, userId, from, to);
      });
      const workspace = { key, label };
      workspaces.push(workspace);
      timeZone ??= feed.time_zone;
      for (const item of feed.items) items.push({ ...item, id: item.kind === 'HOLIDAY' ? `${key}:${item.id}` : item.id, workspace });
    }
    const zone = timeZone ?? DEFAULT_TIME_ZONE;
    items.sort((a, b) => sortKey(a, zone).localeCompare(sortKey(b, zone)));
    return { from, to, time_zone: zone, items, workspaces };
  }

  /**
   * Whether the caller has a subscription link, and since when (the link itself is shown only once).
   * `tenant` null: the personal link across all workspaces; otherwise that workspace's link.
   */
  async linkStatus(tenant: Tenant | null, userId: string): Promise<{ active: boolean; created_at: Date | null }> {
    const row = await this.tokenRepo.findOne({ where: { organization_id: tenant?.organizationId ?? IsNull(), user_id: userId, revoked_at: IsNull() }, order: { created_at: 'DESC' } });
    return { active: Boolean(row), created_at: row?.created_at ?? null };
  }

  /** Makes a new subscription link (the old one stops working) and returns its path once. */
  async newLink(tenant: Tenant | null, userId: string): Promise<{ path: string; created_at: Date }> {
    await this.revoke(tenant, userId);
    const token = randomBytes(32).toString('base64url');
    const row = await this.tokenRepo.save(this.tokenRepo.create({ organization_id: tenant?.organizationId ?? null, user_id: userId, token_hash: hashOf(token) }));
    return { path: `/calendar/ical/${token}.ics`, created_at: row.created_at };
  }

  /** Turns the subscription link off (the row is kept). */
  async revoke(tenant: Tenant | null, userId: string): Promise<void> {
    await this.tokenRepo.update({ organization_id: tenant?.organizationId ?? IsNull(), user_id: userId, revoked_at: IsNull() }, { revoked_at: new Date() });
  }

  /**
   * The iCal text for a subscription link: 30 days back to 90 ahead. 404 when the link is unknown
   * or turned off, the person left the organisation, or the plan has no calendar. A personal link
   * covers every workspace the person is in now that has the calendar (404 when none has).
   */
  async ical(token: string): Promise<string> {
    const notFound = () => new NotFoundException('Calendar link not found');
    const row = await this.tokenRepo.findOne({ where: { token_hash: hashOf(token.replace(/\.ics$/, '')), revoked_at: IsNull() }, relations: ['user'] });
    if (!row) throw notFound();
    const title = `Instructor — ${row.user?.full_name ?? ''}`.trim();
    if (row.organization_id === null) {
      const today = schoolDateIn(DEFAULT_TIME_ZONE, new Date());
      const feed = await this.personalBetween(row.user_id, addDays(today, -ICAL_DAYS_BACK), addDays(today, ICAL_DAYS_AHEAD));
      if (feed.workspaces.length === 0) throw notFound();
      await this.tokenRepo.update({ id: row.id }, { last_used_at: new Date() });
      return icalCalendar(title, feed.items.flatMap((item) => icalEventOf(item, feed.time_zone)));
    }
    const tenant = await this.tenantOf(row.organization_id, row.user_id);
    if (!tenant || !(await this.entitlements.hasFeature(row.organization_id, FeatureKey.CALENDAR))) throw notFound();
    // The feed's services read the request's workspace, as they do for a signed-in request.
    TenantContext.set(tenant);
    const timeZone = await this.orgSettings.timeZone(row.organization_id);
    const today = schoolDateIn(timeZone, new Date());
    const feed = await this.between(tenant, row.user_id, addDays(today, -ICAL_DAYS_BACK), addDays(today, ICAL_DAYS_AHEAD));
    await this.tokenRepo.update({ id: row.id }, { last_used_at: new Date() });
    return icalCalendar(title, feed.items.flatMap((item) => icalEventOf(item, timeZone)));
  }

  private async between(tenant: Tenant, userId: string, from: string, to: string): Promise<CalendarFeed> {
    const organizationId = tenant.organizationId;
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const items: FeedItem[] = [];

    // Classes and closed days, month by month as on My attendance.
    const months = new Set<string>();
    for (let date = from; date <= to; date = addDays(date, 1)) months.add(date.slice(0, 7));
    const classes: Extract<FeedItem, { kind: 'CLASS' }>[] = [];
    for (const month of months) {
      const view = await this.myAttendance.calendar(tenant, userId, month);
      for (const day of view.days) {
        if (day.date < from || day.date > to) continue;
        if (day.closed) {
          items.push({ kind: 'HOLIDAY', id: `closed:${day.date}`, date: day.date, title: day.closed.holiday_name ?? null, reason: day.closed.reason });
        }
        for (const lesson of day.classes) {
          classes.push({
            kind: 'CLASS',
            id: `${lesson.slot_id}:${day.date}`,
            date: day.date,
            starts_at: zonedInstant(day.date, lesson.start_time, timeZone),
            ends_at: zonedInstant(day.date, lesson.end_time, timeZone),
            title: `${lesson.section.class_name} ${lesson.section.name}`.trim(),
            section: lesson.section,
            subject: null,
            teacher: null,
            room: null,
            role: lesson.role,
            status: lesson.status,
          });
        }
      }
    }
    const details = await this.routine.detailsOf(organizationId, classes.map((item) => item.id.split(':')[0]));
    for (const item of classes) {
      const detail = details.get(item.id.split(':')[0]);
      items.push({ ...item, subject: detail?.subject?.name ?? null, teacher: detail?.teacher?.full_name ?? null, room: detail?.room ?? null });
    }

    // Events, in ranges the events list allows.
    for (let start = from; start <= to; start = addDays(start, MAX_FEED_DAYS)) {
      const end = [addDays(start, MAX_FEED_DAYS - 1), to].sort()[0];
      for (const event of await this.events.list(tenant, userId, start, end, true)) {
        if (items.some((item) => item.kind === 'EVENT' && item.id === event.id)) continue;
        items.push({
          kind: 'EVENT',
          id: event.id,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          title: event.title,
          event_type: event.type,
          place: event.place,
          cancelled: event.status === EventStatusEnum.CANCELLED,
        });
      }
    }

    // Exams: a student's exams; staff the ones they made.
    const start = zonedInstant(from, '00:00', timeZone);
    const end = zonedInstant(addDays(to, 1), '00:00', timeZone);
    if (tenant.viaEnrolment || tenant.memberRole === STUDENT) {
      const scope = { session_mode: 'organization', organization_id: organizationId } as JwtPayloadInterface;
      for (const exam of await this.studentExams.getUpcomingExams(userId, scope, 'ASC', true)) {
        const examStart = new Date(exam.exam_start_time);
        const examEnd = new Date(exam.exam_end_time);
        if (examStart < end && examEnd > start) {
          items.push({ kind: 'EXAM', id: exam.id, starts_at: examStart, ends_at: examEnd, title: exam.test_name ?? exam.subject ?? '', class_name: exam.class_name ?? null });
        }
      }
    } else {
      for (const exam of await this.exams.calendarExams(organizationId, userId, false, start, end)) {
        items.push({ kind: 'EXAM', id: exam.id, starts_at: exam.exam_start_time, ends_at: exam.exam_end_time, title: exam.test_name ?? '', class_name: exam.class_name });
      }
    }

    // Homework due in the range: a student's own; staff the homework they set or teach.
    for (const homework of await this.homework.dueBetween(tenant, userId, start, end)) {
      if (!homework.due_at) continue;
      items.push({
        kind: 'HOMEWORK',
        id: homework.id,
        starts_at: homework.due_at,
        ends_at: homework.due_at,
        title: homework.title,
        subject: homework.subject.name,
        sections: [...new Set(homework.targets.map((target) => target.section_label))],
        handed_in: homework.my_submission ? true : this.homework.isStaff(tenant) ? null : false,
      });
    }

    items.sort((a, b) => sortKey(a, timeZone).localeCompare(sortKey(b, timeZone)));
    return { from, to, time_zone: timeZone, items };
  }

  /** The person's workspace in the organisation, as OrganizationContextGuard would set it; null when they left. */
  private async tenantOf(organizationId: string, userId: string): Promise<Tenant | null> {
    const kind = await this.orgSettings.kind(organizationId);
    const membership = await this.access.getMembership(organizationId, userId);
    if (membership) return { organizationId, kind, memberRole: membership.role };
    // A student of a solo teacher's classes has no membership: access is through enrolment.
    const user = await this.tokenRepo.manager.getRepository(UserEntity).findOne({ where: { id: userId }, select: ['id', 'role'] });
    return user?.role === 'STUDENT' ? { organizationId, kind, memberRole: STUDENT, viaEnrolment: true } : null;
  }
}

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

/** Closed days sort first in their day; everything else by start. */
function sortKey(item: FeedItem, timeZone: string): string {
  if (item.kind === 'HOLIDAY') return `${item.date}T00:00:00.000Z#0`;
  return `${schoolDateIn(timeZone, item.starts_at)}T${item.starts_at.toISOString().slice(11)}#1`;
}

/** A calendar item as an iCal event; closed weekly off days are left out. */
function icalEventOf(item: FeedItem, timeZone: string): IcalEvent[] {
  switch (item.kind) {
    case 'CLASS':
      return [
        {
          uid: `class-${item.id.replace(':', '-')}@instructor`,
          start: item.starts_at,
          end: item.ends_at,
          summary: item.subject ? `${item.subject} — ${item.title}` : item.title,
          location: item.room,
          description: item.teacher,
          cancelled: item.status === 'CANCELLED',
        },
      ];
    case 'EVENT':
      return [{ uid: `event-${item.id}@instructor`, start: item.starts_at, end: item.ends_at, summary: item.title, location: item.place, cancelled: item.cancelled }];
    case 'EXAM':
      return [{ uid: `exam-${item.id}@instructor`, start: item.starts_at, end: item.ends_at, summary: item.title, description: item.class_name }];
    case 'HOMEWORK':
      return [{ uid: `homework-${item.id}@instructor`, start: item.starts_at, end: item.ends_at, summary: `Due: ${item.title}`, description: item.subject }];
    case 'HOLIDAY':
      if (item.reason !== 'HOLIDAY') return [];
      return [
        {
          // Two workspaces may close on the same day: a personal link keeps them apart.
          uid: item.workspace ? `holiday-${item.workspace.key.replace(':', '-')}-${item.date}@instructor` : `holiday-${item.date}@instructor`,
          start: zonedInstant(item.date, '00:00', timeZone),
          end: zonedInstant(addDays(item.date, 1), '00:00', timeZone),
          summary: item.title || 'Holiday',
        },
      ];
  }
}
