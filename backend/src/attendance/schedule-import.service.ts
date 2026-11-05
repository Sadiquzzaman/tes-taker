import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditEntry, AuditService } from 'src/audit/audit.service';
import { MAX_SLOTS_PER_SECTION, RoutineSlotsService, SlotInput } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { BranchesService } from 'src/organizations/branches.service';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { ScheduleImportDto, ScheduleImportRowDto } from './dto/schedule-import.dto';
import { SectionAttendanceModeEnum, SectionClassTypeEnum } from './entities/section-attendance-settings.entity';
import { parseClassType, parseDays, parseGrace, parseMode, parseTime, sameName } from './schedule-csv';
import { isManager, SectionSettings, SectionSetupService } from './section-setup.service';

/** Why a row of the schedule CSV cannot be used; the web app translates each code (`classSetup.import.issues`). */
export const IMPORT_ISSUES = {
  CLASS_MISSING: 'CLASS_MISSING',
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  SECTION_MISSING: 'SECTION_MISSING',
  SECTION_NOT_FOUND: 'SECTION_NOT_FOUND',
  NAME_AMBIGUOUS: 'NAME_AMBIGUOUS',
  NOT_YOUR_SECTION: 'NOT_YOUR_SECTION',
  DAYS_INVALID: 'DAYS_INVALID',
  START_INVALID: 'START_INVALID',
  END_INVALID: 'END_INVALID',
  END_BEFORE_START: 'END_BEFORE_START',
  OVERLAP: 'OVERLAP',
  TOO_MANY: 'TOO_MANY',
  CLASS_TYPE_INVALID: 'CLASS_TYPE_INVALID',
  MODE_INVALID: 'MODE_INVALID',
  GRACE_INVALID: 'GRACE_INVALID',
  BRANCH_NOT_FOUND: 'BRANCH_NOT_FOUND',
  BRANCH_NOT_ALLOWED: 'BRANCH_NOT_ALLOWED',
  SETTINGS_CONFLICT: 'SETTINGS_CONFLICT',
} as const;
type ImportIssue = (typeof IMPORT_ISSUES)[keyof typeof IMPORT_ISSUES];

/** A checked row: its line in the file (the header is line 1) and what is wrong with it. */
export interface ImportRowResult {
  row: number;
  class: string | null;
  section: string | null;
  days: number[];
  start: string | null;
  end: string | null;
  errors: ImportIssue[];
}

/** What importing does to one section. */
export interface ImportSectionPlan {
  id: string;
  name: string;
  class_name: string;
  slots_before: number;
  slots_after: number;
  settings_changed: boolean;
}

export interface ImportPreview {
  session: { id: string; name: string };
  /** True when no row has an error; only then can the file be imported. */
  valid: boolean;
  rows: ImportRowResult[];
  sections: ImportSectionPlan[];
}

/** The settings columns a row sets (undefined = left empty). */
type RowSettings = { class_type?: SectionClassTypeEnum; mode?: SectionAttendanceModeEnum; grace_minutes?: number | null; branch_id?: string | null };

interface SectionWork {
  section: SectionEntity;
  slots: SlotInput[];
  rows: number[];
  settings: RowSettings;
}

/**
 * Schedule CSV import (ATT-16): one line per section and weekly time ("Class 6, A, Sat;Mon, 16:00,
 * 17:30"), optionally with the section's class type, mode, grace period and branch. Every row is
 * checked before anything is saved; the file is imported only when no row has an error, in one
 * transaction. Each section named in the file gets exactly the times listed for it (the same file
 * imported twice changes nothing); other sections are left alone. A teacher on an existing slot is
 * kept when the file lists the same day and times. Same permissions as the setup grid.
 */
@Injectable()
export class ScheduleImportService {
  constructor(
    private readonly sections: SectionsService,
    private readonly setup: SectionSetupService,
    private readonly slots: RoutineSlotsService,
    private readonly branches: BranchesService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async preview(tenant: Tenant, userId: string, dto: ScheduleImportDto): Promise<ImportPreview> {
    return (await this.check(tenant, userId, dto)).preview;
  }

  async import(tenant: Tenant, userId: string, dto: ScheduleImportDto): Promise<ImportPreview> {
    const { preview, work } = await this.check(tenant, userId, dto);
    if (!preview.valid) {
      throw new BadRequestException({
        message: 'Some rows have problems; fix the file and check it again',
        code: ATTENDANCE_ERRORS.SCHEDULE_IMPORT_INVALID,
      });
    }
    const organizationId = tenant.organizationId;
    const entries: AuditEntry[] = [];
    await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, organizationId);
      for (const item of work) {
        const result = await this.slots.replace(manager, item.section, item.slots, userId);
        if (result.changed) entries.push(this.setup.scheduleAudit(item.section, userId, result.before, result.after, 'import'));
        const before = await this.settingsOf(item.section, manager);
        const after = mergeSettings(before, item.settings);
        const diff = auditChanges(before, after);
        if (diff.after) {
          if (after.branch_id !== item.section.branch_id) await this.sections.setBranch(item.section, after.branch_id, userId, manager);
          await this.setup.saveSettings(manager, item.section, after, userId);
          entries.push({
            action: AUDIT_ACTIONS.SECTION_ATTENDANCE_UPDATE,
            organizationId,
            actorId: userId,
            entityType: 'section',
            entityId: item.section.id,
            before: diff.before,
            after: diff.after,
            reason: 'CSV import',
          });
        }
      }
    });
    if (entries.length > 0) this.audit.recordMany(entries);
    return preview;
  }

  private async check(tenant: Tenant, userId: string, dto: ScheduleImportDto): Promise<{ preview: ImportPreview; work: SectionWork[] }> {
    const organizationId = tenant.organizationId;
    const { session, sections } = await this.sections.listWithClasses(dto.session_id);
    if (session.status !== AcademicSessionStatusEnum.ACTIVE) {
      throw new BadRequestException('This session is closed; the owner can reopen it');
    }
    const [editable, branches, main] = await Promise.all([
      this.setup.editableSectionIds(tenant, userId, session.id),
      this.branches.listActive(organizationId),
      this.branches.defaultBranch(organizationId),
    ]);
    const manager = isManager(tenant);

    const rows: ImportRowResult[] = [];
    const work = new Map<string, SectionWork>();
    dto.rows.forEach((input, index) => {
      const errors: ImportIssue[] = [];
      const result: ImportRowResult = {
        row: index + 2,
        class: input.class?.trim() || null,
        section: input.section?.trim() || null,
        days: [],
        start: null,
        end: null,
        errors,
      };
      rows.push(result);

      const section = this.findSection(sections, input, errors);
      if (section && editable !== 'all' && !editable.has(section.id)) errors.push(IMPORT_ISSUES.NOT_YOUR_SECTION);

      const days = parseDays(input.days);
      if (!days) errors.push(IMPORT_ISSUES.DAYS_INVALID);
      const start = parseTime(input.start);
      const end = parseTime(input.end);
      if (!start) errors.push(IMPORT_ISSUES.START_INVALID);
      if (!end) errors.push(IMPORT_ISSUES.END_INVALID);
      if (start && end && end <= start) errors.push(IMPORT_ISSUES.END_BEFORE_START);
      Object.assign(result, { days: days ?? [], start, end });

      const settings = this.rowSettings(input, branches, main.id, manager, errors);
      if (!section || errors.length > 0) return;

      const item = work.get(section.id) ?? { section, slots: [], rows: [], settings: {} };
      work.set(section.id, item);
      for (const key of Object.keys(settings) as (keyof RowSettings)[]) {
        if (item.settings[key] !== undefined && item.settings[key] !== settings[key]) {
          errors.push(IMPORT_ISSUES.SETTINGS_CONFLICT);
          return;
        }
      }
      const added = (days as number[]).map((day) => ({ day_of_week: day, start_time: start as string, end_time: end as string, teacher_id: null }));
      if (added.some((slot) => item.slots.some((other) => overlaps(slot, other)))) {
        errors.push(IMPORT_ISSUES.OVERLAP);
        return;
      }
      if (item.slots.length + added.length > MAX_SLOTS_PER_SECTION) {
        errors.push(IMPORT_ISSUES.TOO_MANY);
        return;
      }
      Object.assign(item.settings, settings);
      item.slots.push(...added);
      item.rows.push(result.row);
    });

    // Keep the teacher of an existing slot the file lists unchanged.
    const sectionIds = [...work.keys()];
    const [current, settings] = await Promise.all([
      this.slots.activeBySection(organizationId, sectionIds),
      this.setup.settingsBySection(organizationId, sectionIds),
    ]);
    const plans: ImportSectionPlan[] = [];
    for (const item of work.values()) {
      const existing = current.get(item.section.id) ?? [];
      item.slots = item.slots.map((slot) => ({
        ...slot,
        teacher_id:
          existing.find((old) => old.day_of_week === slot.day_of_week && old.start_time === slot.start_time && old.end_time === slot.end_time)
            ?.teacher_id ?? null,
      }));
      const own = settings.get(item.section.id);
      const before: SectionSettings = {
        branch_id: item.section.branch_id,
        class_type: own?.class_type ?? SectionClassTypeEnum.IN_PERSON,
        mode: own?.mode ?? SectionAttendanceModeEnum.SELF_CHECKIN,
        grace_minutes: own?.grace_minutes ?? null,
      };
      plans.push({
        id: item.section.id,
        name: item.section.name,
        class_name: item.section.class.class_name,
        slots_before: existing.length,
        slots_after: item.slots.length,
        settings_changed: Boolean(auditChanges(before, mergeSettings(before, item.settings)).after),
      });
    }

    const valid = rows.every((row) => row.errors.length === 0);
    return {
      preview: { session: { id: session.id, name: session.name }, valid, rows, sections: plans },
      work: [...work.values()],
    };
  }

  private findSection(sections: SectionEntity[], input: ScheduleImportRowDto, errors: ImportIssue[]): SectionEntity | null {
    if (!input.class?.trim()) {
      errors.push(IMPORT_ISSUES.CLASS_MISSING);
      return null;
    }
    if (!input.section?.trim()) {
      errors.push(IMPORT_ISSUES.SECTION_MISSING);
      return null;
    }
    const ofClass = sections.filter((section) => sameName(section.class.class_name, input.class));
    if (ofClass.length === 0) {
      errors.push(IMPORT_ISSUES.CLASS_NOT_FOUND);
      return null;
    }
    const matches = ofClass.filter((section) => sameName(section.name, input.section));
    if (matches.length === 0) {
      errors.push(IMPORT_ISSUES.SECTION_NOT_FOUND);
      return null;
    }
    // Two classes with the same name each have a section of that name.
    if (matches.length > 1) {
      errors.push(IMPORT_ISSUES.NAME_AMBIGUOUS);
      return null;
    }
    return matches[0];
  }

  private rowSettings(
    input: ScheduleImportRowDto,
    branches: { id: string; name: string | null; is_default: boolean }[],
    mainId: string,
    manager: boolean,
    errors: ImportIssue[],
  ): RowSettings {
    const settings: RowSettings = {};
    const classType = parseClassType(input.class_type);
    if (classType === null) errors.push(IMPORT_ISSUES.CLASS_TYPE_INVALID);
    else if (classType) settings.class_type = classType;
    const mode = parseMode(input.mode);
    if (mode === null) errors.push(IMPORT_ISSUES.MODE_INVALID);
    else if (mode) settings.mode = mode;
    const grace = parseGrace(input.grace);
    if (Number.isNaN(grace)) errors.push(IMPORT_ISSUES.GRACE_INVALID);
    else if (grace !== undefined) settings.grace_minutes = grace;

    const branchName = input.branch?.trim();
    if (branchName) {
      if (!manager) {
        errors.push(IMPORT_ISSUES.BRANCH_NOT_ALLOWED);
      } else if (['main', 'main branch', 'প্রধান শাখা'].some((word) => sameName(word, branchName))) {
        settings.branch_id = null;
      } else {
        const branch = branches.find((b) => sameName(b.name, branchName));
        if (!branch) errors.push(IMPORT_ISSUES.BRANCH_NOT_FOUND);
        else settings.branch_id = branch.id === mainId ? null : branch.id;
      }
    }
    return settings;
  }

  private async settingsOf(section: SectionEntity, manager: EntityManager): Promise<SectionSettings> {
    const own = (await this.setup.settingsBySection(section.organization_id, [section.id], manager)).get(section.id);
    return {
      branch_id: section.branch_id,
      class_type: own?.class_type ?? SectionClassTypeEnum.IN_PERSON,
      mode: own?.mode ?? SectionAttendanceModeEnum.SELF_CHECKIN,
      grace_minutes: own?.grace_minutes ?? null,
    };
  }
}

function mergeSettings(before: SectionSettings, changes: RowSettings): SectionSettings {
  return {
    branch_id: changes.branch_id !== undefined ? changes.branch_id : before.branch_id,
    class_type: changes.class_type ?? before.class_type,
    mode: changes.mode ?? before.mode,
    grace_minutes: changes.grace_minutes !== undefined ? changes.grace_minutes : before.grace_minutes,
  };
}

const overlaps = (a: SlotInput, b: SlotInput) => a.day_of_week === b.day_of_week && a.start_time < b.end_time && b.start_time < a.end_time;
