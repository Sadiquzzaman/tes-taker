import { Injectable } from '@nestjs/common';
import { SectionsService } from 'src/academics/sections.service';
import { HolidaysService } from 'src/calendar/holidays.service';
import { RoutineSlotsService } from 'src/calendar/routine-slots.service';
import { addDays, daysBetween, isoDayOf, schoolDateIn } from 'src/common/utils/school-date.util';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { ClassSessionsService, SectionContext, sessionKey, teacherOf } from './class-sessions.service';
import { ClassSessionStatusEnum } from './entities/class-session.entity';

/** A class on a date, with that day's times and teacher (a one-day change applied). */
export interface ClassOccurrence {
  /** `slotId:date` */
  id: string;
  slot_id: string;
  section_id: string;
  section_label: string;
  date: string;
  starts_at: Date;
  ends_at: Date;
  /** Who teaches it that day: the substitute, else the routine's teacher; null when none is named. */
  teacher_id: string | null;
}

/**
 * The classes that start in a time window (for calendar reminders, CAL-05): every active slot of
 * an open section on its days, with a day's other times or substitute (P5-04), leaving out
 * cancelled classes and closed days. No access checks; the caller decides who is told.
 */
@Injectable()
export class ClassOccurrencesService {
  constructor(
    private readonly sessions: ClassSessionsService,
    private readonly slots: RoutineSlotsService,
    private readonly holidays: HolidaysService,
    private readonly orgSettings: OrgSettingsService,
    private readonly sections: SectionsService,
  ) {}

  /** The sections' active students, by section id. */
  async studentsOf(organizationId: string, sectionIds: string[]): Promise<Map<string, string[]>> {
    const rosters = await this.sections.activeStudentsOfSections(organizationId, sectionIds);
    return new Map([...rosters].map(([sectionId, rows]) => [sectionId, rows.map((row) => row.student_id)]));
  }

  async startingBetween(organizationId: string, from: Date, to: Date): Promise<ClassOccurrence[]> {
    const timeZone = await this.orgSettings.timeZone(organizationId);
    const bySection = await this.slots.activeOfOrganization(organizationId);
    if (bySection.size === 0) return [];
    // A moved class may start a little away from its routine time: look a day either side.
    const firstDate = addDays(schoolDateIn(timeZone, from), -1);
    const lastDate = addDays(schoolDateIn(timeZone, to), 1);
    const refs = [...bySection].flatMap(([section_id, slots]) => slots.map((slot) => ({ section_id, slot })));
    const [contexts, closedDays, saved] = await Promise.all([
      this.sessions.contexts(organizationId, [...bySection.keys()]),
      this.holidays.closedDays(organizationId, firstDate, lastDate),
      this.sessions.savedSessions(organizationId, refs.map((ref) => ref.slot.id), firstDate, lastDate),
    ]);
    const closed = new Set(closedDays.map((day) => day.date));
    const result: ClassOccurrence[] = [];
    for (let i = 0; i < daysBetween(firstDate, lastDate); i++) {
      const date = addDays(firstDate, i);
      if (closed.has(date)) continue;
      for (const ref of refs) {
        if (ref.slot.day_of_week !== isoDayOf(date)) continue;
        const context = contexts.get(ref.section_id) as SectionContext | undefined;
        if (!context?.open) continue;
        const session = saved.get(sessionKey(ref.slot.id, date));
        if (session?.status === ClassSessionStatusEnum.CANCELLED) continue;
        const window = this.sessions.window(context, ref.slot, date, timeZone, session);
        if (window.starts_at <= from || window.starts_at > to) continue;
        result.push({
          id: sessionKey(ref.slot.id, date).replace('|', ':'),
          slot_id: ref.slot.id,
          section_id: ref.section_id,
          section_label: `${context.section.class?.class_name ?? ''} ${context.section.name}`.trim(),
          date,
          starts_at: window.starts_at,
          ends_at: window.ends_at,
          teacher_id: teacherOf(ref.slot, session),
        });
      }
    }
    return result;
  }
}
