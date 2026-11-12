import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { ROUTINE_ERRORS, SCHEDULE_ERRORS } from './calendar-errors';
import { RoutineSlotInputDto, UpdateRoutineSlotDto } from './dto/routine.dto';
import { RoutineSlotEntity } from './entities/routine-slot.entity';
import { hhmm, MAX_SLOTS_PER_SECTION, RoutineSlotsService } from './routine-slots.service';

const { OWNER, ADMIN, ASSISTANT } = OrganizationMemberRoleEnum;
/** Owners, admins and staff (assistants) change every section's routine (CAL-01); teachers the sections they teach. */
const ROUTINE_MANAGERS = [OWNER, ADMIN, ASSISTANT];

export type ClashKind = 'TEACHER' | 'ROOM';

/** Another slot booked at an overlapping time with the same teacher or room (CAL-02). */
export interface RoutineClash {
  kind: ClashKind;
  slot_id: string;
  section: { id: string; name: string; class_name: string | null };
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** One weekly slot of the routine as the API returns it. */
export interface RoutineSlotView {
  id: string;
  session_id: string;
  section: { id: string; name: string; class_name: string | null };
  subject: { offering_id: string; id: string; name: string } | null;
  teacher: { id: string; full_name: string } | null;
  room: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  /** Teacher or room clashes the admin confirmed (CAL-02); shown in the grid. */
  clashes: RoutineClash[];
}

/** `GET /routine`: a session's whole routine, with what the grid needs to edit it. */
export interface RoutineView {
  session: { id: string; name: string; status: AcademicSessionStatusEnum };
  /** The caller may change at least one section's routine. */
  can_manage: boolean;
  /** Sections whose routine the caller may change: all for owners, admins and staff; the ones a teacher teaches. */
  editable_section_ids: string[];
  /** `room`: the section's own room, the default for its new periods. */
  sections: { id: string; name: string; class_name: string | null; room: string | null }[];
  subject_classes: { offering_id: string; section_id: string; subject: { id: string; name: string }; teacher_ids: string[] }[];
  /** Everyone who teaches in these sections: a subject's teachers and teachers named on a period, by name. */
  teachers: { id: string; full_name: string }[];
  rooms: string[];
  slots: RoutineSlotView[];
}

/** What a slot is checked as: times "HH:MM", a trimmed room or null. */
interface Wanted {
  day_of_week: number;
  start_time: string;
  end_time: string;
  offering_id: string | null;
  teacher_id: string | null;
  room: string | null;
}

/**
 * The weekly class routine (CAL-01, CAL-02, design §9.9), built on the section schedules' rows
 * (`routine_slots`, P3-02): each slot can name a subject class, a teacher and a room. A section
 * never has two overlapping slots (refused). A teacher or room booked twice at overlapping times in
 * open sessions is a clash: refused with 409 ROUTINE_CLASH and the list, and saved when the admin
 * confirms; the grid then marks it. Changing a slot's day or times keeps the old row (removed) and
 * adds a new one, so class sessions made from it keep their history.
 */
@Injectable()
export class RoutineService {
  constructor(
    @InjectRepository(RoutineSlotEntity)
    private readonly slotRepo: Repository<RoutineSlotEntity>,
    private readonly slots: RoutineSlotsService,
    private readonly sections: SectionsService,
    private readonly sessions: AcademicSessionsService,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The session's routine (the default session when none is given). Staff read every section; a
   * student reads the sections they study in. Owners, admins and staff edit every section, a
   * teacher the sections they teach (`editable_section_ids`); a closed session is read-only.
   */
  async routine(tenant: Tenant, userId: string, sessionId?: string): Promise<RoutineView> {
    const { session, sections: all } = await this.sections.listWithClasses(sessionId);
    const student = isStudent(tenant);
    const own = student ? new Set((await this.sections.activeSectionsOfStudent(tenant.organizationId, userId)).map((row) => row.section_id)) : null;
    const sections = own ? all.filter((section) => own.has(section.id)) : all;
    const visible = new Set(sections.map((section) => section.id));
    const [offerings, rows] = await Promise.all([
      this.sections.listOfferingsForSession(session.id),
      this.activeRows(tenant.organizationId, { session_id: session.id }),
    ]);
    const shown = rows.filter((row) => visible.has(row.section_id));
    const clashes = student ? new Map<string, RoutineClash[]>() : await this.clashesOf(tenant.organizationId, shown);
    const open = session.status === AcademicSessionStatusEnum.ACTIVE;
    const visibleOfferings = offerings.filter((offering) => visible.has(offering.section_id));
    const teachers = new Map<string, string>();
    for (const offering of visibleOfferings) for (const teacher of offering.teachers) teachers.set(teacher.id, teacher.full_name);
    for (const row of shown) if (row.teacher) teachers.set(row.teacher.id, row.teacher.full_name ?? '');
    const editable = !open || student ? [] : isManager(tenant) ? [...visible] : [...(await this.sections.sectionIdsTaughtBy(tenant.organizationId, session.id, userId))].filter((id) => visible.has(id));
    return {
      session: { id: session.id, name: session.name, status: session.status },
      can_manage: editable.length > 0,
      editable_section_ids: editable,
      sections: sections.map((section) => ({ id: section.id, name: section.name, class_name: section.class?.class_name ?? null, room: student ? null : section.room })),
      subject_classes: visibleOfferings.map((offering) => ({
        offering_id: offering.id,
        section_id: offering.section_id,
        subject: { id: offering.subject.id, name: offering.subject.name },
        teacher_ids: offering.teachers.map((teacher) => teacher.id),
      })),
      teachers: [...teachers].map(([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
      rooms: student ? [] : await this.roomsOf(tenant.organizationId),
      slots: shown.map((row) => viewOf(row, clashes.get(row.id) ?? [])),
    };
  }

  /** Subject, teacher and room of these slots (removed ones too), by slot id, for the calendar (CAL-07). */
  async detailsOf(organizationId: string, slotIds: string[]): Promise<Map<string, Pick<RoutineSlotView, 'subject' | 'teacher' | 'room'>>> {
    if (slotIds.length === 0) return new Map();
    const rows = await this.slotRepo.find({
      where: { organization_id: organizationId, id: In([...new Set(slotIds)]) },
      relations: ['offering', 'offering.subject', 'teacher'],
    });
    return new Map(rows.map((row) => [row.id, { subject: viewOf(row, []).subject, teacher: viewOf(row, []).teacher, room: row.room }]));
  }

  /** Adds a slot; teacher or room clashes need `confirm_clashes`. */
  async add(tenant: Tenant, userId: string, dto: RoutineSlotInputDto): Promise<RoutineSlotView> {
    const [view] = await this.addMany(tenant, userId, { ...dto, days: [dto.day_of_week] });
    return view;
  }

  /**
   * Adds the same period on several days (one slot per day), all or none. A section overlap on any
   * day is refused; teacher or room clashes on any day are listed together and need `confirm_clashes`.
   */
  async addMany(tenant: Tenant, userId: string, dto: Omit<RoutineSlotInputDto, 'day_of_week'> & { days: number[] }): Promise<RoutineSlotView[]> {
    const section = await this.sections.findSectionWithClass(dto.section_id);
    await this.assertCanEdit(tenant, userId, section.id, section.session_id);
    this.sessions.assertSessionOpen(section.session);
    const days = [...new Set(dto.days)];
    if (days.length === 0) {
      throw new BadRequestException({ message: 'Choose at least one day', code: SCHEDULE_ERRORS.TIME_INVALID });
    }
    const wanted = days.map((day) => this.normalise({ ...dto, day_of_week: day }));
    await this.assertParts(tenant.organizationId, section.id, wanted[0]);

    const ids = await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, tenant.organizationId);
      const repo = manager.getRepository(RoutineSlotEntity);
      const count = await repo.count({ where: { organization_id: tenant.organizationId, section_id: section.id, is_active: ActiveStatusEnum.ACTIVE } });
      if (count + wanted.length > MAX_SLOTS_PER_SECTION) {
        throw new BadRequestException({ message: `A section can have at most ${MAX_SLOTS_PER_SECTION} weekly slots`, code: SCHEDULE_ERRORS.TOO_MANY });
      }
      // Overlaps stop at once; clashes of every day are gathered into one answer.
      const clashes: RoutineClash[] = [];
      for (const slot of wanted) {
        try {
          await this.assertBookable(manager, tenant.organizationId, section.id, slot, null, dto.confirm_clashes === true);
        } catch (error) {
          const body = error instanceof ConflictException ? (error.getResponse() as { code?: string; details?: { clashes?: RoutineClash[] } }) : null;
          if (body?.code !== ROUTINE_ERRORS.CLASH) throw error;
          clashes.push(...(body.details?.clashes ?? []));
        }
      }
      if (clashes.length) {
        throw new ConflictException({ message: 'This teacher or room is already booked at that time', code: ROUTINE_ERRORS.CLASH, details: { clashes } });
      }
      const now = new Date();
      const inserted = await repo.insert(
        wanted.map((slot) => ({
          ...slot,
          organization_id: tenant.organizationId,
          session_id: section.session_id,
          section_id: section.id,
          created_by: userId,
          created_at: now,
        })),
      );
      return inserted.identifiers.map((row) => row.id as string);
    });
    ids.forEach((id, index) =>
      this.audit.record({
        action: AUDIT_ACTIONS.ROUTINE_ADD,
        organizationId: tenant.organizationId,
        actorId: userId,
        entityType: 'routine_slot',
        entityId: id,
        after: { section_id: section.id, ...wanted[index], ...(dto.confirm_clashes ? { clashes_confirmed: true } : {}) },
      }),
    );
    const views: RoutineSlotView[] = [];
    for (const id of ids) views.push(await this.one(tenant.organizationId, id));
    return views;
  }

  /**
   * Copies another section's week (same session) into this section, replacing its periods (the old
   * rows are kept, removed). Each subject becomes this section's class of the same subject (none
   * when it has no such class); the teacher is that class's teacher when it has exactly one and
   * they are free then; rooms are not copied.
   */
  async copyWeek(tenant: Tenant, userId: string, sectionId: string, fromSectionId: string): Promise<{ slots: number; without_teacher: number }> {
    const target = await this.sections.findSectionWithClass(sectionId);
    const source = await this.sections.findSectionWithClass(fromSectionId);
    if (source.id === target.id || source.session_id !== target.session_id) {
      throw new BadRequestException({ message: 'Copy from another section of the same session', code: ROUTINE_ERRORS.COPY_INVALID });
    }
    await this.assertCanEdit(tenant, userId, target.id, target.session_id);
    this.sessions.assertSessionOpen(target.session);
    const sourceRows = await this.activeRows(tenant.organizationId, { section_id: source.id });
    const offerings = await this.sections.listOfferings(target.id);
    const bySubject = new Map(offerings.map((offering) => [offering.subject.id, offering]));

    const result = await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, tenant.organizationId);
      const repo = manager.getRepository(RoutineSlotEntity);
      const now = new Date();
      const before = await repo.find({ where: { organization_id: tenant.organizationId, section_id: target.id, is_active: ActiveStatusEnum.ACTIVE } });
      if (before.length) {
        await repo.update(
          { id: In(before.map((row) => row.id)), organization_id: tenant.organizationId },
          { is_active: ActiveStatusEnum.INACTIVE, removed_at: now, removed_by: userId, updated_by: userId, updated_at: now },
        );
      }
      const others = (await this.activeRows(tenant.organizationId, {}, manager)).filter((row) => row.session?.status === AcademicSessionStatusEnum.ACTIVE);
      let withoutTeacher = 0;
      const rows = sourceRows.map((row) => {
        const slot = wantedOf(row);
        const offering = row.offering?.subject ? bySubject.get(row.offering.subject.id) : undefined;
        let teacherId = offering && offering.teachers.length === 1 ? offering.teachers[0].id : null;
        if (teacherId && others.some((other) => other.teacher_id === teacherId && overlaps(slot, wantedOf(other)))) teacherId = null;
        if (!teacherId) withoutTeacher++;
        return {
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          offering_id: offering?.id ?? null,
          teacher_id: teacherId,
          room: null,
          organization_id: tenant.organizationId,
          session_id: target.session_id,
          section_id: target.id,
          created_by: userId,
          created_at: now,
        };
      });
      if (rows.length) await repo.insert(rows);
      return { slots: rows.length, without_teacher: withoutTeacher, removed: before.length };
    });
    this.audit.record({
      action: AUDIT_ACTIONS.ROUTINE_COPY,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'section',
      entityId: target.id,
      after: { from_section_id: source.id, slots: result.slots, removed: result.removed },
    });
    return { slots: result.slots, without_teacher: result.without_teacher };
  }

  /**
   * Changes a slot. A new day or time removes the old row and adds a new one (the result has a new
   * id); a new subject, teacher or room changes the row in place.
   */
  async change(tenant: Tenant, userId: string, id: string, dto: UpdateRoutineSlotDto): Promise<RoutineSlotView> {
    const current = await this.activeSlot(tenant.organizationId, id);
    await this.assertCanEdit(tenant, userId, current.section_id, current.session_id);
    this.sessions.assertSessionOpen(current.session);
    const before = wantedOf(current);
    const wanted = this.normalise({
      day_of_week: dto.day_of_week ?? before.day_of_week,
      start_time: dto.start_time ?? before.start_time,
      end_time: dto.end_time ?? before.end_time,
      offering_id: dto.offering_id !== undefined ? dto.offering_id : before.offering_id,
      teacher_id: dto.teacher_id !== undefined ? dto.teacher_id : before.teacher_id,
      room: dto.room !== undefined ? dto.room : before.room,
    });
    if (sameSlot(before, wanted)) return this.one(tenant.organizationId, id);
    await this.assertParts(tenant.organizationId, current.section_id, wanted);
    const moved = before.day_of_week !== wanted.day_of_week || before.start_time !== wanted.start_time || before.end_time !== wanted.end_time;

    const resultId = await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, tenant.organizationId);
      await this.assertBookable(manager, tenant.organizationId, current.section_id, wanted, current.id, dto.confirm_clashes === true);
      const repo = manager.getRepository(RoutineSlotEntity);
      const now = new Date();
      if (!moved) {
        await repo.update({ id: current.id, organization_id: tenant.organizationId }, { ...wanted, updated_by: userId, updated_at: now });
        return current.id;
      }
      await repo.update(
        { id: current.id, organization_id: tenant.organizationId },
        { is_active: ActiveStatusEnum.INACTIVE, removed_at: now, removed_by: userId, updated_by: userId, updated_at: now },
      );
      const inserted = await repo.insert({
        ...wanted,
        organization_id: tenant.organizationId,
        session_id: current.session_id,
        section_id: current.section_id,
        created_by: userId,
        created_at: now,
      });
      return inserted.identifiers[0].id as string;
    });
    this.audit.record({
      action: AUDIT_ACTIONS.ROUTINE_CHANGE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'routine_slot',
      entityId: resultId,
      before: { section_id: current.section_id, ...before },
      after: { section_id: current.section_id, ...wanted, ...(resultId !== current.id ? { replaces: current.id } : {}), ...(dto.confirm_clashes ? { clashes_confirmed: true } : {}) },
    });
    return this.one(tenant.organizationId, resultId);
  }

  /** Removes a slot from the routine; the row is kept (is_active '0', removed_at/by). */
  async remove(tenant: Tenant, userId: string, id: string): Promise<void> {
    const current = await this.activeSlot(tenant.organizationId, id);
    await this.assertCanEdit(tenant, userId, current.section_id, current.session_id);
    this.sessions.assertSessionOpen(current.session);
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, tenant.organizationId);
      await manager
        .getRepository(RoutineSlotEntity)
        .update(
          { id: current.id, organization_id: tenant.organizationId, is_active: ActiveStatusEnum.ACTIVE },
          { is_active: ActiveStatusEnum.INACTIVE, removed_at: now, removed_by: userId, updated_by: userId, updated_at: now },
        );
    });
    this.audit.record({
      action: AUDIT_ACTIONS.ROUTINE_REMOVE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'routine_slot',
      entityId: current.id,
      before: { section_id: current.section_id, ...wantedOf(current) },
    });
  }

  /** Owners, admins and staff change every section's routine; a teacher the sections they teach (403 otherwise). */
  private async assertCanEdit(tenant: Tenant, userId: string, sectionId: string, sessionId: string): Promise<void> {
    if (isManager(tenant)) return;
    if (!isStudent(tenant) && (await this.sections.sectionIdsTaughtBy(tenant.organizationId, sessionId, userId)).has(sectionId)) return;
    throw new ForbiddenException({ message: "Only owners, admins, staff and the section's teachers change its routine", code: ROUTINE_ERRORS.NOT_ALLOWED });
  }

  /** Real times with the start first, a room of at most 40 characters (400 SCHEDULE_TIME_INVALID otherwise). */
  private normalise(input: { day_of_week: number; start_time: string; end_time: string; offering_id?: string | null; teacher_id?: string | null; room?: string | null }): Wanted {
    const start = hhmm(input.start_time);
    const end = hhmm(input.end_time);
    if (!Number.isInteger(input.day_of_week) || input.day_of_week < 1 || input.day_of_week > 7 || !start || !end || end <= start) {
      throw new BadRequestException({ message: 'A slot needs a day and a start time before its end time', code: SCHEDULE_ERRORS.TIME_INVALID });
    }
    const room = (input.room ?? '').trim().replace(/\s+/g, ' ');
    return {
      day_of_week: input.day_of_week,
      start_time: start,
      end_time: end,
      offering_id: input.offering_id ?? null,
      teacher_id: input.teacher_id ?? null,
      room: room ? room.slice(0, 40) : null,
    };
  }

  /** The subject class belongs to the slot's section; the teacher teaches in the organisation. */
  private async assertParts(organizationId: string, sectionId: string, wanted: Wanted): Promise<void> {
    if (wanted.offering_id) {
      const [found] = await this.sections.offeringsWithTeachers(organizationId, [wanted.offering_id]);
      if (!found || found.offering.section_id !== sectionId) {
        throw new BadRequestException({ message: "Choose one of this section's subjects", code: ROUTINE_ERRORS.SUBJECT_INVALID });
      }
    }
    if (wanted.teacher_id) {
      const membership = await this.access.getMembership(organizationId, wanted.teacher_id);
      if (!this.access.isAssignableTeachingRole(membership?.role)) {
        throw new BadRequestException({ message: 'The teacher must be a teaching member of this organisation', code: ROUTINE_ERRORS.TEACHER_INVALID });
      }
    }
  }

  /**
   * No overlap with another slot of the section (400 SCHEDULE_OVERLAP); teacher and room clashes
   * in open sessions are refused (409 ROUTINE_CLASH with `details.clashes`) unless confirmed.
   */
  private async assertBookable(manager: EntityManager, organizationId: string, sectionId: string, wanted: Wanted, ignoreId: string | null, confirmed: boolean): Promise<void> {
    const sameDay = (await this.activeRows(organizationId, { day_of_week: wanted.day_of_week }, manager)).filter(
      (row) => row.id !== ignoreId && row.session?.status === AcademicSessionStatusEnum.ACTIVE && overlaps(wanted, wantedOf(row)),
    );
    const overlap = sameDay.find((row) => row.section_id === sectionId);
    if (overlap) {
      throw new BadRequestException({
        message: 'This section already has a class at that time',
        code: SCHEDULE_ERRORS.OVERLAP,
        details: { slot_id: overlap.id, section: sectionOf(overlap), start_time: wantedOf(overlap).start_time, end_time: wantedOf(overlap).end_time },
      });
    }
    const clashes = sameDay.flatMap((row) => clashKinds(wanted, wantedOf(row)).map((kind) => clashOf(row, kind)));
    if (clashes.length && !confirmed) {
      throw new ConflictException({ message: 'This teacher or room is already booked at that time', code: ROUTINE_ERRORS.CLASH, details: { clashes } });
    }
  }

  /** Each slot's clashes with other active slots of open sessions. */
  private async clashesOf(organizationId: string, rows: RoutineSlotEntity[]): Promise<Map<string, RoutineClash[]>> {
    const result = new Map<string, RoutineClash[]>();
    const booked = rows.filter((row) => row.teacher_id || row.room);
    if (booked.length === 0) return result;
    const others = (await this.activeRows(organizationId, { day_of_week: In([...new Set(booked.map((row) => Number(row.day_of_week)))]) })).filter(
      (row) => row.session?.status === AcademicSessionStatusEnum.ACTIVE,
    );
    for (const row of booked) {
      const mine = wantedOf(row);
      const found = others
        .filter((other) => other.id !== row.id && overlaps(mine, wantedOf(other)))
        .flatMap((other) => clashKinds(mine, wantedOf(other)).map((kind) => clashOf(other, kind)));
      if (found.length) result.set(row.id, found);
    }
    return result;
  }

  /** Rooms already used in the organisation's open sessions, for the room picker. */
  private async roomsOf(organizationId: string): Promise<string[]> {
    const rows: { room: string }[] = await this.slotRepo
      .createQueryBuilder('slot')
      .innerJoin('slot.session', 'session')
      .select('DISTINCT slot.room', 'room')
      .where('slot.organization_id = :organizationId', { organizationId })
      .andWhere('slot.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .andWhere('slot.room IS NOT NULL')
      .andWhere('session.status = :open', { open: AcademicSessionStatusEnum.ACTIVE })
      .getRawMany();
    return rows.map((row) => row.room).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }

  private async activeRows(organizationId: string, where: Record<string, unknown>, manager?: EntityManager): Promise<RoutineSlotEntity[]> {
    const rows = await (manager ?? this.slotRepo.manager).getRepository(RoutineSlotEntity).find({
      where: { ...where, organization_id: organizationId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['session', 'section', 'section.class', 'offering', 'offering.subject', 'teacher'],
    });
    return rows.sort(byWeek);
  }

  private async activeSlot(organizationId: string, id: string): Promise<RoutineSlotEntity> {
    const [row] = await this.activeRows(organizationId, { id });
    if (!row) throw new NotFoundException({ message: 'Routine slot not found', code: ROUTINE_ERRORS.NOT_FOUND });
    return row;
  }

  private async one(organizationId: string, id: string): Promise<RoutineSlotView> {
    const row = await this.activeSlot(organizationId, id);
    return viewOf(row, (await this.clashesOf(organizationId, [row])).get(row.id) ?? []);
  }
}

const isManager = (tenant: Tenant) => !tenant.viaEnrolment && ROUTINE_MANAGERS.includes(tenant.memberRole);

const isStudent = (tenant: Tenant) => Boolean(tenant.viaEnrolment) || tenant.memberRole === OrganizationMemberRoleEnum.STUDENT;

function wantedOf(row: RoutineSlotEntity): Wanted {
  return {
    day_of_week: Number(row.day_of_week),
    start_time: hhmm(row.start_time) as string,
    end_time: hhmm(row.end_time) as string,
    offering_id: row.offering_id,
    teacher_id: row.teacher_id,
    room: row.room,
  };
}

const overlaps = (a: Wanted, b: Wanted) => a.day_of_week === b.day_of_week && a.start_time < b.end_time && b.start_time < a.end_time;

const sameRoom = (a: string | null, b: string | null) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** Why two overlapping slots clash: the same teacher, the same room, or both. */
function clashKinds(a: Wanted, b: Wanted): ClashKind[] {
  const kinds: ClashKind[] = [];
  if (a.teacher_id && a.teacher_id === b.teacher_id) kinds.push('TEACHER');
  if (sameRoom(a.room, b.room)) kinds.push('ROOM');
  return kinds;
}

const sameSlot = (a: Wanted, b: Wanted) =>
  a.day_of_week === b.day_of_week && a.start_time === b.start_time && a.end_time === b.end_time && a.offering_id === b.offering_id && a.teacher_id === b.teacher_id && a.room === b.room;

const byWeek = (a: RoutineSlotEntity, b: RoutineSlotEntity) =>
  Number(a.day_of_week) - Number(b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time));

const sectionOf = (row: RoutineSlotEntity) => ({ id: row.section_id, name: row.section?.name ?? '', class_name: row.section?.class?.class_name ?? null });

function clashOf(row: RoutineSlotEntity, kind: ClashKind): RoutineClash {
  const slot = wantedOf(row);
  return { kind, slot_id: row.id, section: sectionOf(row), day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time };
}

function viewOf(row: RoutineSlotEntity, clashes: RoutineClash[]): RoutineSlotView {
  const slot = wantedOf(row);
  return {
    id: row.id,
    session_id: row.session_id,
    section: sectionOf(row),
    subject: row.offering?.subject ? { offering_id: row.offering.id, id: row.offering.subject.id, name: row.offering.subject.name } : null,
    teacher: row.teacher ? { id: row.teacher.id, full_name: row.teacher.full_name } : null,
    room: row.room,
    day_of_week: slot.day_of_week,
    start_time: slot.start_time,
    end_time: slot.end_time,
    clashes,
  };
}
