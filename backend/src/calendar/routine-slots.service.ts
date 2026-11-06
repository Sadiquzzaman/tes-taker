import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { SCHEDULE_ERRORS } from './calendar-errors';
import { RoutineSlotEntity } from './entities/routine-slot.entity';

/** Most weekly slots one section can have. */
export const MAX_SLOTS_PER_SECTION = 30;

/** A weekly slot as given: ISO day, "HH:MM" times in the organisation's time zone, an optional teacher. */
export interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  teacher_id: string | null;
}

/** A weekly slot as the API returns it. */
export interface SlotView extends SlotInput {
  id: string;
  teacher: { id: string; full_name: string } | null;
}

/** The section a schedule belongs to. */
export interface SlotSection {
  id: string;
  organization_id: string;
  session_id: string;
}

/**
 * Weekly routine slots of sections (ATT-16 now, CAL-01/02 later; `routine_slots` belongs to the
 * calendar module). Owns the schedule rules: real times with the start before the end, no two
 * slots of a section overlapping on a day, and a teacher never in two overlapping slots of the
 * same session. A schedule is replaced as a whole: unchanged slots keep their row and id, changed
 * or dropped ones are removed by keeping the row (is_active '0', removed_at/by). No access checks.
 */
@Injectable()
export class RoutineSlotsService {
  constructor(
    @InjectRepository(RoutineSlotEntity)
    private readonly slotRepo: Repository<RoutineSlotEntity>,
  ) {}

  /** Active slots of the sections, by section id, in week order (Saturday first is the web app's job). */
  async activeBySection(organizationId: string, sectionIds: string[], manager?: EntityManager): Promise<Map<string, SlotView[]>> {
    const result = new Map<string, SlotView[]>(sectionIds.map((id) => [id, []]));
    if (sectionIds.length === 0) return result;
    const rows = await (manager ?? this.slotRepo.manager).getRepository(RoutineSlotEntity).find({
      where: { organization_id: organizationId, section_id: In(sectionIds), is_active: ActiveStatusEnum.ACTIVE },
      relations: ['teacher'],
      order: { day_of_week: 'ASC', start_time: 'ASC' },
    });
    for (const row of rows) result.get(row.section_id)?.push(view(row));
    return result;
  }

  /** Every active slot of the organisation, by section id (for owners', admins' and assistants' attendance views). */
  async activeOfOrganization(organizationId: string): Promise<Map<string, SlotView[]>> {
    const rows = await this.slotRepo.find({
      where: { organization_id: organizationId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['teacher'],
      order: { day_of_week: 'ASC', start_time: 'ASC' },
    });
    const result = new Map<string, SlotView[]>();
    for (const row of rows) result.set(row.section_id, [...(result.get(row.section_id) ?? []), view(row)]);
    return result;
  }

  /** Active slots where the teacher is named, by section id (for class check-in, ATT-11). */
  async activeOfTeacher(organizationId: string, teacherId: string): Promise<Map<string, SlotView[]>> {
    const rows = await this.slotRepo.find({
      where: { organization_id: organizationId, teacher_id: teacherId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['teacher'],
      order: { day_of_week: 'ASC', start_time: 'ASC' },
    });
    const result = new Map<string, SlotView[]>();
    for (const row of rows) result.set(row.section_id, [...(result.get(row.section_id) ?? []), view(row)]);
    return result;
  }

  /** Organisations with at least one active slot (for the attendance jobs, which run outside a request). */
  async organizationsWithActiveSlots(): Promise<string[]> {
    const rows: { organization_id: string }[] = await this.slotRepo
      .createQueryBuilder('slot')
      .select('DISTINCT slot.organization_id', 'organization_id')
      .where('slot.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .getRawMany();
    return rows.map((row) => row.organization_id);
  }

  /** When each slot was added, by id (a class session exists only from then on; ATT-18). */
  async createdAt(organizationId: string, ids: string[]): Promise<Map<string, Date>> {
    if (ids.length === 0) return new Map();
    const rows = await this.slotRepo.find({ where: { organization_id: organizationId, id: In(ids) }, select: ['id', 'created_at'] });
    return new Map(rows.map((row) => [row.id, row.created_at]));
  }

  /** An active slot of the organisation with its section id, or null (another organisation's id is never found). */
  async findActive(organizationId: string, id: string): Promise<(SlotView & { section_id: string }) | null> {
    const row = await this.slotRepo.findOne({
      where: { id, organization_id: organizationId, is_active: ActiveStatusEnum.ACTIVE },
      relations: ['teacher'],
    });
    return row ? { ...view(row), section_id: row.section_id } : null;
  }

  /**
   * Checks the slots and normalises them (sorted, "HH:MM"); throws 400 with a `code` and the index of
   * the first bad slot. Does not look at other sections; `replace` checks teacher clashes.
   */
  normalise(slots: SlotInput[]): SlotInput[] {
    if (slots.length > MAX_SLOTS_PER_SECTION) {
      throw new BadRequestException({
        message: `A section can have at most ${MAX_SLOTS_PER_SECTION} weekly slots`,
        code: SCHEDULE_ERRORS.TOO_MANY,
      });
    }
    const normalised = slots.map((slot, index) => {
      const start = hhmm(slot.start_time);
      const end = hhmm(slot.end_time);
      if (!Number.isInteger(slot.day_of_week) || slot.day_of_week < 1 || slot.day_of_week > 7 || !start || !end || end <= start) {
        throw new BadRequestException({ message: 'Each slot needs a day and a start time before its end time', code: SCHEDULE_ERRORS.TIME_INVALID, details: { slot: index } });
      }
      return { day_of_week: slot.day_of_week, start_time: start, end_time: end, teacher_id: slot.teacher_id ?? null };
    });
    normalised.forEach((slot, index) => {
      const other = normalised.findIndex((o, i) => i !== index && overlaps(slot, o));
      if (other !== -1) {
        throw new BadRequestException({
          message: 'Two slots of this section overlap on the same day',
          code: SCHEDULE_ERRORS.OVERLAP,
          details: { slot: Math.max(index, other) },
        });
      }
    });
    return normalised.sort(byWeek);
  }

  /**
   * Replaces a section's weekly slots inside `manager`'s transaction (the caller holds the lock from
   * `lockOrganization`). Returns the slots before and after, without ids, for the audit log.
   */
  async replace(
    manager: EntityManager,
    section: SlotSection,
    slots: SlotInput[],
    actorId: string,
  ): Promise<{ before: SlotInput[]; after: SlotInput[]; changed: boolean }> {
    const wanted = this.normalise(slots);
    const repo = manager.getRepository(RoutineSlotEntity);
    await this.assertNoTeacherClash(manager, section, wanted);
    const current = await repo.find({
      where: { organization_id: section.organization_id, section_id: section.id, is_active: ActiveStatusEnum.ACTIVE },
      order: { day_of_week: 'ASC', start_time: 'ASC' },
    });
    const before = current.map(input).sort(byWeek);
    const unused = [...current];
    const added: SlotInput[] = [];
    for (const slot of wanted) {
      const keep = unused.findIndex((row) => key(input(row)) === key(slot));
      if (keep !== -1) unused.splice(keep, 1);
      else added.push(slot);
    }
    const now = new Date();
    if (unused.length > 0) {
      await repo.update(
        { id: In(unused.map((row) => row.id)), organization_id: section.organization_id },
        { is_active: ActiveStatusEnum.INACTIVE, removed_at: now, removed_by: actorId, updated_by: actorId, updated_at: now },
      );
    }
    if (added.length > 0) {
      await repo.insert(
        added.map((slot) => ({
          ...slot,
          organization_id: section.organization_id,
          session_id: section.session_id,
          section_id: section.id,
          created_by: actorId,
          created_at: now,
        })),
      );
    }
    return { before, after: wanted, changed: unused.length > 0 || added.length > 0 };
  }

  /** Serialises schedule changes of one organisation, so two edits cannot together create a teacher clash. */
  async lockOrganization(manager: EntityManager, organizationId: string): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext('routine_slots:' || $1))`, [organizationId]);
  }

  /** A teacher can't be in two overlapping slots of the same session (other sections' active slots). */
  private async assertNoTeacherClash(manager: EntityManager, section: SlotSection, slots: SlotInput[]): Promise<void> {
    const teacherIds = [...new Set(slots.map((slot) => slot.teacher_id).filter((id): id is string => Boolean(id)))];
    if (teacherIds.length === 0) return;
    const others = await manager.getRepository(RoutineSlotEntity).find({
      where: {
        organization_id: section.organization_id,
        session_id: section.session_id,
        section_id: Not(section.id),
        teacher_id: In(teacherIds),
        is_active: ActiveStatusEnum.ACTIVE,
      },
      relations: ['section', 'section.class'],
    });
    slots.forEach((slot, index) => {
      const clash = others.find((other) => other.teacher_id === slot.teacher_id && overlaps(slot, input(other)));
      if (clash) {
        throw new ConflictException({
          message: 'This teacher already has a class at that time in another section',
          code: SCHEDULE_ERRORS.TEACHER_CLASH,
          details: {
            slot: index,
            section: clash.section ? { id: clash.section.id, name: clash.section.name, class_name: clash.section.class?.class_name ?? null } : null,
          },
        });
      }
    });
  }
}

/** "H:MM", "HH:MM" or "HH:MM:SS" → "HH:MM"; null when it is not a real time. */
export function hhmm(value: string | null | undefined): string | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec((value ?? '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

const overlaps = (a: SlotInput, b: SlotInput) => a.day_of_week === b.day_of_week && a.start_time < b.end_time && b.start_time < a.end_time;
const key = (slot: SlotInput) => `${slot.day_of_week}|${slot.start_time}|${slot.end_time}|${slot.teacher_id ?? ''}`;
const byWeek = (a: SlotInput, b: SlotInput) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time);

function input(row: RoutineSlotEntity): SlotInput {
  return {
    day_of_week: Number(row.day_of_week),
    start_time: hhmm(row.start_time) as string,
    end_time: hhmm(row.end_time) as string,
    teacher_id: row.teacher_id,
  };
}

function view(row: RoutineSlotEntity): SlotView {
  return {
    id: row.id,
    ...input(row),
    teacher: row.teacher ? { id: row.teacher.id, full_name: row.teacher.full_name } : null,
  };
}
