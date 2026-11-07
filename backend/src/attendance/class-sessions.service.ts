import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { SectionsService } from 'src/academics/sections.service';
import { SlotView } from 'src/calendar/routine-slots.service';
import { BranchEntity } from 'src/organizations/entities/branch.entity';
import { BranchesService } from 'src/organizations/branches.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { CHECKIN_OPENS_BEFORE_MINUTES, SessionWindow, sessionWindow } from './class-session-time';
import { AttendanceRecordEntity } from './entities/attendance-record.entity';
import { ClassSessionEntity, ClassSessionStatusEnum } from './entities/class-session.entity';
import {
  SectionAttendanceModeEnum,
  SectionAttendanceSettingsEntity,
  SectionClassTypeEnum,
} from './entities/section-attendance-settings.entity';

/** What attendance needs to know about a section: its class, setup, grace period and branch. */
export interface SectionContext {
  section: SectionEntity;
  class_type: SectionClassTypeEnum;
  mode: SectionAttendanceModeEnum;
  /** The section's own grace period, else the organisation's. */
  grace_minutes: number;
  branch: BranchEntity;
  /** The section's academic session is open (closed sessions take no check-ins). */
  open: boolean;
}

/** A record as the API returns it (the position itself is never returned). */
export interface RecordView {
  id: string;
  status: AttendanceRecordEntity['status'];
  checked_in_at: Date | null;
  late_minutes: number | null;
  source: AttendanceRecordEntity['source'];
  distance_m: number | null;
  accuracy_m: number | null;
  flag: AttendanceRecordEntity['flag'];
}

export const sessionKey = (slotId: string, date: string) => `${slotId}|${date}`;

/**
 * Class sessions and their records (design §9.4): the shared reads and writes behind self check-in
 * (ATT-04), "My attendance" (ATT-18) and the teacher's section view (ATT-07). A session row is made
 * on the first write for a slot and date. No access checks; the callers check.
 */
@Injectable()
export class ClassSessionsService {
  constructor(
    @InjectRepository(ClassSessionEntity)
    private readonly sessionRepo: Repository<ClassSessionEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly recordRepo: Repository<AttendanceRecordEntity>,
    @InjectRepository(SectionAttendanceSettingsEntity)
    private readonly settingsRepo: Repository<SectionAttendanceSettingsEntity>,
    private readonly sections: SectionsService,
    private readonly branches: BranchesService,
    private readonly orgSettings: OrgSettingsService,
  ) {}

  /** The sections' attendance context, by section id (another organisation's sections are left out). */
  async contexts(organizationId: string, sectionIds: string[]): Promise<Map<string, SectionContext>> {
    const ids = [...new Set(sectionIds)];
    const result = new Map<string, SectionContext>();
    if (ids.length === 0) return result;
    const [sections, settingsRows, attendance, main] = await Promise.all([
      this.sections.findSectionsWithClasses(organizationId, ids),
      this.settingsRepo.find({ where: { organization_id: organizationId, section_id: In(ids) } }),
      this.orgSettings.getAttendance(organizationId),
      this.branches.defaultBranch(organizationId),
    ]);
    const settings = new Map(settingsRows.map((row) => [row.section_id, row]));
    const branches = new Map<string, BranchEntity>([[main.id, main]]);
    for (const section of sections) {
      if (section.branch_id && !branches.has(section.branch_id)) {
        branches.set(section.branch_id, (await this.branches.findActive(organizationId, section.branch_id)) ?? main);
      }
      const own = settings.get(section.id);
      result.set(section.id, {
        section,
        class_type: own?.class_type ?? SectionClassTypeEnum.IN_PERSON,
        mode: own?.mode ?? SectionAttendanceModeEnum.SELF_CHECKIN,
        grace_minutes: own?.grace_minutes ?? attendance.late_grace_minutes,
        branch: branches.get(section.branch_id ?? main.id) ?? main,
        open: section.session?.status === AcademicSessionStatusEnum.ACTIVE,
      });
    }
    return result;
  }

  /** The slot's window on a date. A saved session keeps its own start and end (a later schedule change does not move it). */
  window(
    context: SectionContext,
    slot: Pick<SlotView, 'start_time' | 'end_time'>,
    date: string,
    timeZone: string,
    saved?: Pick<ClassSessionEntity, 'starts_at' | 'ends_at'>,
  ): SessionWindow {
    const window = sessionWindow(date, slot.start_time, slot.end_time, timeZone, context.grace_minutes);
    if (!saved) return window;
    return {
      opens_at: new Date(saved.starts_at.getTime() - CHECKIN_OPENS_BEFORE_MINUTES * 60_000),
      starts_at: saved.starts_at,
      late_after: new Date(saved.starts_at.getTime() + context.grace_minutes * 60_000),
      ends_at: saved.ends_at,
    };
  }

  /** Saved sessions of these slots from `from` to `to`, by `sessionKey(slot, date)`. */
  async savedSessions(organizationId: string, slotIds: string[], from: string, to: string): Promise<Map<string, ClassSessionEntity>> {
    const result = new Map<string, ClassSessionEntity>();
    if (slotIds.length === 0) return result;
    const rows = await this.sessionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.canceller', 'canceller')
      .leftJoinAndSelect('s.substitute', 'substitute')
      .leftJoinAndSelect('s.changer', 'changer')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('s.routine_slot_id IN (:...slotIds)', { slotIds: [...new Set(slotIds)] })
      .andWhere('s.date BETWEEN :from AND :to', { from, to })
      .getMany();
    for (const row of rows) result.set(sessionKey(row.routine_slot_id, row.date), row);
    return result;
  }

  /** Records of these sessions, by session id; only `personId`'s when given. */
  async records(organizationId: string, sessionIds: string[], personId?: string): Promise<Map<string, AttendanceRecordEntity[]>> {
    const result = new Map<string, AttendanceRecordEntity[]>();
    if (sessionIds.length === 0) return result;
    const rows = await this.recordRepo.find({
      where: { organization_id: organizationId, class_attendance_id: In(sessionIds), ...(personId ? { person_id: personId } : {}) },
    });
    for (const row of rows) result.set(row.class_attendance_id, [...(result.get(row.class_attendance_id) ?? []), row]);
    return result;
  }

  /** The session of a slot on a date, created if it does not exist yet (safe when two requests race). */
  async ensureSession(
    manager: EntityManager,
    organizationId: string,
    sectionId: string,
    slotId: string,
    date: string,
    window: Pick<SessionWindow, 'starts_at' | 'ends_at'>,
  ): Promise<ClassSessionEntity> {
    const repo = manager.getRepository(ClassSessionEntity);
    await repo
      .createQueryBuilder()
      .insert()
      .into(ClassSessionEntity)
      .values({ organization_id: organizationId, section_id: sectionId, routine_slot_id: slotId, date, starts_at: window.starts_at, ends_at: window.ends_at })
      .orIgnore()
      .execute();
    return repo.findOneOrFail({ where: { organization_id: organizationId, routine_slot_id: slotId, date } });
  }

  /** Classes from `from` to `to` that the teacher takes as a substitute (P5-04), not cancelled. */
  async substitutedFor(organizationId: string, teacherId: string, from: string, to: string): Promise<ClassSessionEntity[]> {
    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('s.substitute_teacher_id = :teacherId', { teacherId })
      .andWhere('s.date BETWEEN :from AND :to', { from, to })
      .andWhere('s.status <> :cancelled', { cancelled: ClassSessionStatusEnum.CANCELLED })
      .getMany();
  }
}

/** Who teaches a class on its date: the substitute for that day, else the routine's teacher (P5-04). */
export const teacherOf = (slot: Pick<SlotView, 'teacher_id'>, session?: Pick<ClassSessionEntity, 'substitute_teacher_id'> | null): string | null =>
  session?.substitute_teacher_id ?? slot.teacher_id;

/**
 * Whether a teacher's slot is someone else's on this date: another teacher substitutes for it
 * (P5-04). The substitute gets the class instead.
 */
export const coveredByOther = (session: Pick<ClassSessionEntity, 'substitute_teacher_id'> | null | undefined, teacherId: string): boolean =>
  Boolean(session?.substitute_teacher_id && session.substitute_teacher_id !== teacherId);

export function recordView(record: AttendanceRecordEntity): RecordView {
  return {
    id: record.id,
    status: record.status,
    checked_in_at: record.checked_in_at,
    late_minutes: record.late_minutes,
    source: record.source,
    distance_m: record.distance_m,
    accuracy_m: record.accuracy_m,
    flag: record.flag,
  };
}
