import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, Repository } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { addDays, daysBetween } from 'src/common/utils/school-date.util';
import { NOTIFICATION_EVENTS } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { zonedDayStart } from './calendar-time';
import { EVENT_ERRORS, MAX_EVENT_DAYS } from './calendar-errors';
import { CancelEventDto, CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventAttendeeEntity } from './entities/event-attendee.entity';
import { EventEntity, EventStatusEnum, EventTypeEnum } from './entities/event.entity';

const { OWNER, ADMIN, ASSISTANT, TEACHER, STUDENT } = OrganizationMemberRoleEnum;
/** Owners, admins and assistants see and change every event and invite the whole organisation. */
const EVENT_MANAGERS = [OWNER, ADMIN, ASSISTANT];
/** A change this close to the event tells its attendees at once (CAL-06). */
export const CHANGE_NOTICE_HOURS = 48;
/** Longest range `GET /events` returns, in days. */
const MAX_RANGE_DAYS = 62;

/** An event as the API returns it. */
export interface EventView {
  id: string;
  type: EventTypeEnum;
  title: string;
  description: string | null;
  starts_at: Date;
  ends_at: Date;
  place: string | null;
  whole_org: boolean;
  status: EventStatusEnum;
  sections: { id: string; name: string; class_name: string | null }[];
  people: { id: string; full_name: string }[];
  created_by: { id: string; full_name: string } | null;
  cancelled_at: Date | null;
  /** The caller may change or cancel it: owners, admins and assistants, or whoever made it. */
  can_edit: boolean;
}

/**
 * Calendar events (CAL-03, CAL-06; design §9.9): exams, meetings, parent meetings and activities
 * with a time, place and attendees (sections — their students —, chosen people, or the whole
 * organisation). Owners, admins and assistants manage every event; teachers make events for the
 * sections they teach and for people of the organisation, and change their own; everyone sees the
 * events they attend or made. Attendees are told in-app when an event is added, and when it changes
 * or is cancelled within 48 hours of its start. Cancelling keeps the row.
 */
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberRepo: Repository<OrganizationMemberEntity>,
    private readonly sections: SectionsService,
    private readonly orgSettings: OrgSettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Events the caller may see from `from` to `to` (school dates in the organisation's time zone), by
   * start. With `own`, managers too get only the events they attend or made (the personal calendar).
   */
  async list(tenant: Tenant, userId: string, from: string, to: string, own = false): Promise<EventView[]> {
    if (to < from || daysBetween(from, to) > MAX_RANGE_DAYS) {
      throw new BadRequestException({ message: `Choose at most ${MAX_RANGE_DAYS} days`, code: EVENT_ERRORS.TIME_INVALID });
    }
    const timeZone = await this.orgSettings.timeZone(tenant.organizationId);
    const start = zonedDayStart(from, timeZone);
    const end = zonedDayStart(addDays(to, 1), timeZone);
    const query = this.eventRepo
      .createQueryBuilder('event')
      .where('event.organization_id = :organizationId', { organizationId: tenant.organizationId })
      .andWhere('event.starts_at < :end AND event.ends_at > :start', { start, end })
      .orderBy('event.starts_at', 'ASC');
    await this.whereVisible(query, tenant, userId, own);
    return this.views(tenant, userId, await query.getMany());
  }

  async get(tenant: Tenant, userId: string, id: string): Promise<EventView> {
    const [view] = await this.views(tenant, userId, [await this.visible(tenant, userId, id)]);
    return view;
  }

  async create(tenant: Tenant, actor: Pick<UserEntity, 'id' | 'full_name'>, dto: CreateEventDto): Promise<EventView> {
    assertStaff(tenant);
    const times = this.times(dto.starts_at, dto.ends_at, true);
    const attendees = await this.attendees(tenant, actor.id, dto.whole_org ?? false, dto.section_ids ?? [], dto.user_ids ?? []);
    const id = await this.dataSource.transaction(async (manager) => {
      const inserted = await manager.getRepository(EventEntity).insert({
        organization_id: tenant.organizationId,
        type: dto.type,
        title: dto.title,
        description: dto.description || null,
        starts_at: times.starts_at,
        ends_at: times.ends_at,
        place: dto.place || null,
        whole_org: attendees.whole_org,
        created_by: actor.id,
        created_user_name: actor.full_name ?? undefined,
        created_at: new Date(),
      });
      const eventId = inserted.identifiers[0].id as string;
      await this.saveAttendees(manager, eventId, attendees);
      const event = await manager.getRepository(EventEntity).findOneByOrFail({ id: eventId });
      await this.tell(manager, NOTIFICATION_EVENTS.CALENDAR_EVENT_ADDED, event, await this.recipients(manager, event, attendees), actor.id, null);
      return eventId;
    });
    this.audit.record({
      action: AUDIT_ACTIONS.EVENT_CREATE,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'event',
      entityId: id,
      after: { type: dto.type, title: dto.title, starts_at: times.starts_at, ends_at: times.ends_at, place: dto.place || null, ...attendees },
    });
    return this.get(tenant, actor.id, id);
  }

  /** Changes an event; within 48 hours of its start (before or after the change) the attendees are told. */
  async update(tenant: Tenant, actor: Pick<UserEntity, 'id' | 'full_name'>, id: string, dto: UpdateEventDto): Promise<EventView> {
    const event = await this.editable(tenant, actor.id, id);
    const before = await this.snapshot(event);
    const times = this.times(dto.starts_at ?? event.starts_at.toISOString(), dto.ends_at ?? event.ends_at.toISOString(), dto.starts_at !== undefined || dto.ends_at !== undefined);
    const attendees =
      dto.whole_org !== undefined || dto.section_ids !== undefined || dto.user_ids !== undefined
        ? await this.attendees(tenant, actor.id, dto.whole_org ?? before.whole_org, dto.section_ids ?? before.section_ids, dto.user_ids ?? before.user_ids)
        : { whole_org: before.whole_org, section_ids: before.section_ids, user_ids: before.user_ids };
    const changes = {
      type: dto.type ?? event.type,
      title: dto.title ?? event.title,
      description: dto.description !== undefined ? dto.description || null : event.description,
      place: dto.place !== undefined ? dto.place || null : event.place,
      starts_at: times.starts_at,
      ends_at: times.ends_at,
      whole_org: attendees.whole_org,
    };
    const after = { ...changes, section_ids: attendees.section_ids, user_ids: attendees.user_ids };
    if (JSON.stringify(normalise(before)) === JSON.stringify(normalise(after))) return this.get(tenant, actor.id, id);

    await this.dataSource.transaction(async (manager) => {
      const oldRecipients = await this.recipients(manager, event, before);
      await manager.getRepository(EventEntity).update({ id }, { ...changes, updated_by: actor.id, updated_user_name: actor.full_name ?? undefined, updated_at: new Date() });
      await manager.getRepository(EventAttendeeEntity).delete({ event_id: id });
      await this.saveAttendees(manager, id, attendees);
      const saved = await manager.getRepository(EventEntity).findOneByOrFail({ id });
      const newRecipients = await this.recipients(manager, saved, attendees);
      // People added are told it was added; everyone else is told of the change when it is close (CAL-06).
      const added = newRecipients.filter((userId) => !oldRecipients.includes(userId));
      await this.tell(manager, NOTIFICATION_EVENTS.CALENDAR_EVENT_ADDED, saved, added, actor.id, null);
      const moved = before.starts_at.getTime() !== saved.starts_at.getTime() || before.ends_at.getTime() !== saved.ends_at.getTime() || before.place !== saved.place;
      if (moved && (this.isSoon(before.starts_at) || this.isSoon(saved.starts_at))) {
        await this.tell(manager, NOTIFICATION_EVENTS.CALENDAR_EVENT_CHANGED, saved, newRecipients.filter((userId) => !added.includes(userId)), actor.id, null);
      }
    });
    this.audit.record({
      action: AUDIT_ACTIONS.EVENT_UPDATE,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'event',
      entityId: id,
      before: normalise(before),
      after: normalise(after),
    });
    return this.get(tenant, actor.id, id);
  }

  /** Cancels an event (the row is kept); within 48 hours of its start the attendees are told. */
  async cancel(tenant: Tenant, actor: Pick<UserEntity, 'id'>, id: string, dto: CancelEventDto): Promise<EventView> {
    const event = await this.editable(tenant, actor.id, id);
    const attendees = await this.snapshot(event);
    const note = dto.note?.trim() || null;
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(EventEntity).update({ id }, { status: EventStatusEnum.CANCELLED, cancelled_at: new Date(), cancelled_by: actor.id });
      if (this.isSoon(event.starts_at)) {
        await this.tell(manager, NOTIFICATION_EVENTS.CALENDAR_EVENT_CANCELLED, event, await this.recipients(manager, event, attendees), actor.id, note);
      }
    });
    this.audit.record({
      action: AUDIT_ACTIONS.EVENT_CANCEL,
      organizationId: tenant.organizationId,
      actorId: actor.id,
      entityType: 'event',
      entityId: id,
      before: { status: EventStatusEnum.SCHEDULED },
      after: { status: EventStatusEnum.CANCELLED, note },
    });
    return this.get(tenant, actor.id, id);
  }

  /** Scheduled events that start after `from` and by `to`, with everyone attending (for reminders, CAL-05). */
  async startingBetween(organizationId: string, from: Date, to: Date): Promise<{ id: string; title: string; starts_at: Date; place: string | null; user_ids: string[] }[]> {
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.organization_id = :organizationId', { organizationId })
      .andWhere('event.status = :scheduled', { scheduled: EventStatusEnum.SCHEDULED })
      .andWhere('event.starts_at > :from AND event.starts_at <= :to', { from, to })
      .getMany();
    const result: { id: string; title: string; starts_at: Date; place: string | null; user_ids: string[] }[] = [];
    for (const event of events) {
      const attendees = await this.snapshot(event);
      result.push({ id: event.id, title: event.title, starts_at: event.starts_at, place: event.place, user_ids: await this.recipients(this.dataSource.manager, event, attendees) });
    }
    return result;
  }

  /** Organisations with events starting by `to` (for the reminders job). */
  async organizationsWithEvents(from: Date, to: Date): Promise<string[]> {
    const rows: { organization_id: string }[] = await this.eventRepo
      .createQueryBuilder('event')
      .select('DISTINCT event.organization_id', 'organization_id')
      .where('event.status = :scheduled AND event.starts_at > :from AND event.starts_at <= :to', { scheduled: EventStatusEnum.SCHEDULED, from, to })
      .getRawMany();
    return rows.map((row) => row.organization_id);
  }

  /** Real times, the end after the start, at most 14 days long; a new or moved event can't be over already. */
  private times(startsAt: string, endsAt: string, checkPast: boolean): { starts_at: Date; ends_at: Date } {
    const starts_at = new Date(startsAt);
    const ends_at = new Date(endsAt);
    const valid =
      !Number.isNaN(starts_at.getTime()) &&
      !Number.isNaN(ends_at.getTime()) &&
      ends_at > starts_at &&
      ends_at.getTime() - starts_at.getTime() <= MAX_EVENT_DAYS * 24 * 60 * 60_000 &&
      (!checkPast || ends_at.getTime() > Date.now());
    if (!valid) {
      throw new BadRequestException({ message: `An event ends after it starts, lasts at most ${MAX_EVENT_DAYS} days and is not over`, code: EVENT_ERRORS.TIME_INVALID });
    }
    return { starts_at, ends_at };
  }

  /**
   * Checks the attendees: the whole organisation (owners, admins and assistants only), sections of
   * the organisation (a teacher: only sections they teach), and active members of the organisation.
   */
  private async attendees(tenant: Tenant, userId: string, wholeOrg: boolean, sectionIds: string[], userIds: string[]) {
    const section_ids = [...new Set(sectionIds)];
    const user_ids = [...new Set(userIds)];
    if (wholeOrg && !isManager(tenant)) {
      throw new ForbiddenException({ message: 'Only owners, admins and assistants invite the whole organisation', code: EVENT_ERRORS.WHOLE_ORG_FORBIDDEN });
    }
    if (!wholeOrg && section_ids.length === 0 && user_ids.length === 0) {
      throw new BadRequestException({ message: 'Choose who attends', code: EVENT_ERRORS.NO_ATTENDEES });
    }
    if (section_ids.length) {
      const found = await this.sections.findSectionsWithClasses(tenant.organizationId, section_ids);
      const taught = isManager(tenant) ? null : await this.sections.sectionIdsTaughtInOpenSessions(tenant.organizationId, userId);
      if (found.length !== section_ids.length || (taught && section_ids.some((id) => !taught.has(id)))) {
        throw new BadRequestException({ message: 'Choose sections of your organisation that you teach', code: EVENT_ERRORS.ATTENDEE_INVALID });
      }
    }
    if (user_ids.length) {
      const members = await this.memberRepo.count({ where: { organization_id: tenant.organizationId, user_id: In(user_ids), is_active: ActiveStatusEnum.ACTIVE } });
      if (members !== user_ids.length) {
        throw new BadRequestException({ message: 'Choose people of your organisation', code: EVENT_ERRORS.ATTENDEE_INVALID });
      }
    }
    return { whole_org: wholeOrg, section_ids: wholeOrg ? [] : section_ids, user_ids: wholeOrg ? [] : user_ids };
  }

  private async saveAttendees(manager: EntityManager, eventId: string, attendees: { section_ids: string[]; user_ids: string[] }): Promise<void> {
    const rows = [
      ...attendees.section_ids.map((section_id) => ({ event_id: eventId, section_id, user_id: null })),
      ...attendees.user_ids.map((user_id) => ({ event_id: eventId, section_id: null, user_id })),
    ];
    if (rows.length) await manager.getRepository(EventAttendeeEntity).insert(rows);
  }

  /** Who attends: every active member (whole organisation), or the sections' active students and the chosen people. */
  private async recipients(manager: EntityManager, event: EventEntity, attendees: { whole_org: boolean; section_ids: string[]; user_ids: string[] }): Promise<string[]> {
    if (attendees.whole_org) {
      const members = await manager
        .getRepository(OrganizationMemberEntity)
        .find({ where: { organization_id: event.organization_id, is_active: ActiveStatusEnum.ACTIVE }, select: ['user_id'] });
      return [...new Set(members.map((member) => member.user_id))];
    }
    const students = await this.sections.activeStudentsOfSections(event.organization_id, attendees.section_ids);
    return [...new Set([...[...students.values()].flat().map((row) => row.student_id), ...attendees.user_ids])];
  }

  private async tell(
    manager: EntityManager,
    eventType: (typeof NOTIFICATION_EVENTS)['CALENDAR_EVENT_ADDED' | 'CALENDAR_EVENT_CHANGED' | 'CALENDAR_EVENT_CANCELLED'],
    event: EventEntity,
    userIds: string[],
    actorId: string,
    note: string | null,
  ): Promise<void> {
    const to = userIds.filter((id) => id !== actorId);
    if (to.length === 0) return;
    await this.notifications.notifyUsers(
      {
        eventType,
        organizationId: event.organization_id,
        userIds: to,
        variables: { title: event.title, starts_at: event.starts_at.toISOString(), place: event.place ?? '', note: note ?? '', path: '/calendar' },
        dedupeKey: `${eventType}:${event.id}:${Date.now()}`,
        createdBy: actorId,
      },
      manager,
    );
  }

  private isSoon(startsAt: Date): boolean {
    const until = startsAt.getTime() - Date.now();
    return until > -24 * 60 * 60_000 && until <= CHANGE_NOTICE_HOURS * 60 * 60_000;
  }

  /** Limits `query` to events the caller may see: all for managers; else whole-organisation, made by them, or attended. */
  private async whereVisible(query: ReturnType<Repository<EventEntity>['createQueryBuilder']>, tenant: Tenant, userId: string, own = false): Promise<void> {
    if (isManager(tenant) && !own) return;
    const sectionIds = await this.mySectionIds(tenant, userId);
    query.andWhere(
      new Brackets((where) => {
        where
          .where('event.whole_org = true')
          .orWhere('event.created_by = :userId', { userId })
          .orWhere('EXISTS (SELECT 1 FROM event_attendees a WHERE a.event_id = event.id AND a.user_id = :userId)', { userId });
        if (sectionIds.length) {
          where.orWhere('EXISTS (SELECT 1 FROM event_attendees a WHERE a.event_id = event.id AND a.section_id IN (:...sectionIds))', { sectionIds });
        }
      }),
    );
  }

  /** A student's sections; a teacher's sections they teach. */
  private async mySectionIds(tenant: Tenant, userId: string): Promise<string[]> {
    if (tenant.viaEnrolment || tenant.memberRole === STUDENT) {
      return (await this.sections.activeSectionsOfStudent(tenant.organizationId, userId)).map((row) => row.section_id);
    }
    return [...(await this.sections.sectionIdsTaughtInOpenSessions(tenant.organizationId, userId))];
  }

  private async visible(tenant: Tenant, userId: string, id: string): Promise<EventEntity> {
    const query = this.eventRepo
      .createQueryBuilder('event')
      .where('event.organization_id = :organizationId', { organizationId: tenant.organizationId })
      .andWhere('event.id = :id', { id });
    await this.whereVisible(query, tenant, userId);
    const event = await query.getOne();
    if (!event) throw new NotFoundException({ message: 'Event not found', code: EVENT_ERRORS.NOT_FOUND });
    return event;
  }

  private async editable(tenant: Tenant, userId: string, id: string): Promise<EventEntity> {
    const event = await this.visible(tenant, userId, id);
    if (!canEdit(tenant, userId, event)) throw new ForbiddenException({ message: 'Only who made the event, or an admin, changes it', code: EVENT_ERRORS.NOT_FOUND });
    if (event.status === EventStatusEnum.CANCELLED) throw new ConflictException({ message: 'This event is cancelled', code: EVENT_ERRORS.CANCELLED });
    return event;
  }

  private async snapshot(event: EventEntity) {
    const rows = await this.dataSource.getRepository(EventAttendeeEntity).find({ where: { event_id: event.id } });
    return {
      type: event.type,
      title: event.title,
      description: event.description,
      place: event.place,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      whole_org: event.whole_org,
      section_ids: rows.map((row) => row.section_id).filter((id): id is string => Boolean(id)),
      user_ids: rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)),
    };
  }

  private async views(tenant: Tenant, userId: string, events: EventEntity[]): Promise<EventView[]> {
    if (events.length === 0) return [];
    const ids = events.map((event) => event.id);
    const rows = await this.dataSource.getRepository(EventAttendeeEntity).find({ where: { event_id: In(ids) }, relations: ['section', 'section.class', 'user'] });
    const creatorIds = [...new Set(events.map((event) => event.created_by).filter((id): id is string => Boolean(id)))];
    const creators = creatorIds.length
      ? new Map((await this.dataSource.getRepository(UserEntity).find({ where: { id: In(creatorIds) }, select: ['id', 'full_name'] })).map((user) => [user.id, user]))
      : new Map<string, UserEntity>();
    return events.map((event) => {
      const own = rows.filter((row) => row.event_id === event.id);
      const creator = event.created_by ? creators.get(event.created_by) : undefined;
      return {
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        place: event.place,
        whole_org: event.whole_org,
        status: event.status,
        sections: own
          .filter((row) => row.section)
          .map((row) => ({ id: row.section!.id, name: row.section!.name, class_name: row.section!.class?.class_name ?? null })),
        people: own.filter((row) => row.user).map((row) => ({ id: row.user!.id, full_name: row.user!.full_name })),
        created_by: creator ? { id: creator.id, full_name: creator.full_name } : null,
        cancelled_at: event.cancelled_at,
        can_edit: event.status === EventStatusEnum.SCHEDULED && canEdit(tenant, userId, event),
      };
    });
  }
}

const isManager = (tenant: Tenant) => !tenant.viaEnrolment && EVENT_MANAGERS.includes(tenant.memberRole);

const canEdit = (tenant: Tenant, userId: string, event: EventEntity) => isManager(tenant) || event.created_by === userId;

function assertStaff(tenant: Tenant): void {
  if (tenant.viaEnrolment || ![...EVENT_MANAGERS, TEACHER].includes(tenant.memberRole)) {
    throw new ForbiddenException('Only staff add events');
  }
}

/** Comparable form of an event's editable parts (sorted ids, ISO times). */
function normalise(value: {
  type: EventTypeEnum;
  title: string;
  description: string | null;
  place: string | null;
  starts_at: Date;
  ends_at: Date;
  whole_org: boolean;
  section_ids: string[];
  user_ids: string[];
}) {
  return {
    type: value.type,
    title: value.title,
    description: value.description,
    place: value.place,
    starts_at: value.starts_at.toISOString(),
    ends_at: value.ends_at.toISOString(),
    whole_org: value.whole_org,
    section_ids: [...value.section_ids].sort(),
    user_ids: [...value.user_ids].sort(),
  };
}
