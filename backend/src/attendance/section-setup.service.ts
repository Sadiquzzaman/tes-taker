import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AcademicSessionsService } from 'src/academics/academic-sessions.service';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditEntry, AuditService } from 'src/audit/audit.service';
import { RoutineSlotsService, SlotInput, SlotView } from 'src/calendar/routine-slots.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { BranchesService } from 'src/organizations/branches.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { OrgSettingsService } from 'src/organizations/org-settings.service';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { ApplyScheduleDto, SlotDto, UpdateSectionSetupDto } from './dto/section-setup.dto';
import {
  SectionAttendanceModeEnum,
  SectionAttendanceSettingsEntity,
  SectionClassTypeEnum,
} from './entities/section-attendance-settings.entity';

const { OWNER, ADMIN, ASSISTANT } = OrganizationMemberRoleEnum;
/** May set up every section, move sections between branches and apply a schedule to many sections. */
const SETUP_MANAGERS = [OWNER, ADMIN, ASSISTANT];

/** Where a schedule change came from, kept in the audit row. */
/** Where a schedule change came from; 'copy' is kept for older audit rows (Class setup copied weeks until the Routine took over). */
export type ScheduleSource = 'grid' | 'copy' | 'apply' | 'import';

/** One row of the setup grid. */
export interface SectionSetupView {
  id: string;
  name: string;
  class: { id: string; name: string };
  shift: SectionEntity['shift'];
  /** The branch the section meets at (the main branch when the section has none of its own). */
  branch_id: string;
  class_type: SectionClassTypeEnum;
  mode: SectionAttendanceModeEnum;
  /** The section's own grace period; null = the organisation's. */
  grace_minutes: number | null;
  slots: SlotView[];
  /** The caller may change this section's setup and schedule. */
  can_edit: boolean;
}

export interface SetupView {
  session: { id: string; name: string; status: string };
  late_grace_minutes: number;
  main_branch_id: string;
  /** The caller may move sections between branches and apply a schedule to a class or shift. */
  can_manage: boolean;
  sections: SectionSetupView[];
}

export interface SectionSettings {
  branch_id: string | null;
  class_type: SectionClassTypeEnum;
  mode: SectionAttendanceModeEnum;
  grace_minutes: number | null;
}

export interface ApplyResult {
  dry_run: boolean;
  sections: { id: string; name: string; class_name: string; slots_before: number; teachers_dropped: number }[];
}

/**
 * Section attendance setup and schedules (ATT-16): branch, in person / online, self check-in or
 * paper register, grace period, and the weekly slots. Settings rows are this module's
 * (`section_attendance_settings`); the branch is set through academics and the slots through
 * calendar, which owns the schedule rules. Owners, admins and assistants set up every section; a
 * teacher sets up the sections they teach or are class teacher of. Closed sessions are read-only.
 */
@Injectable()
export class SectionSetupService {
  constructor(
    @InjectRepository(SectionAttendanceSettingsEntity)
    private readonly settingsRepo: Repository<SectionAttendanceSettingsEntity>,
    private readonly sections: SectionsService,
    private readonly sessions: AcademicSessionsService,
    private readonly slots: RoutineSlotsService,
    private readonly branches: BranchesService,
    private readonly orgSettings: OrgSettingsService,
    private readonly access: OrganizationAccessService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async grid(tenant: Tenant, userId: string, sessionId?: string): Promise<SetupView> {
    const organizationId = tenant.organizationId;
    const { session, sections } = await this.sections.listWithClasses(sessionId);
    const [main, attendance, settings, slots, editable] = await Promise.all([
      this.branches.defaultBranch(organizationId),
      this.orgSettings.getAttendance(organizationId),
      this.settingsBySection(organizationId, sections.map((s) => s.id)),
      this.slots.activeBySection(organizationId, sections.map((s) => s.id)),
      this.editableSectionIds(tenant, userId, session.id),
    ]);
    const open = session.status === AcademicSessionStatusEnum.ACTIVE;
    return {
      session: { id: session.id, name: session.name, status: session.status },
      late_grace_minutes: attendance.late_grace_minutes,
      main_branch_id: main.id,
      can_manage: open && isManager(tenant),
      sections: sections.map((section) => {
        const own = settings.get(section.id);
        return {
          id: section.id,
          name: section.name,
          class: { id: section.class_id, name: section.class.class_name },
          shift: section.shift,
          branch_id: section.branch_id ?? main.id,
          class_type: own?.class_type ?? SectionClassTypeEnum.IN_PERSON,
          mode: own?.mode ?? SectionAttendanceModeEnum.SELF_CHECKIN,
          grace_minutes: own?.grace_minutes ?? null,
          slots: slots.get(section.id) ?? [],
          can_edit: open && (editable === 'all' || editable.has(section.id)),
        };
      }),
    };
  }

  async updateSection(tenant: Tenant, userId: string, sectionId: string, dto: UpdateSectionSetupDto): Promise<SectionSetupView> {
    const section = await this.editableSection(tenant, userId, sectionId);
    const organizationId = tenant.organizationId;
    if (dto.branch_id !== undefined && !isManager(tenant)) {
      throw new ForbiddenException("Teachers can't move a section to another branch");
    }
    let branchId = section.branch_id;
    if (dto.branch_id !== undefined) {
      const main = await this.branches.defaultBranch(organizationId);
      if (dto.branch_id !== null && dto.branch_id !== main.id) {
        if (!(await this.branches.findActive(organizationId, dto.branch_id))) {
          throw new BadRequestException({ message: 'Choose one of your branches', code: ATTENDANCE_ERRORS.BRANCH_NOT_FOUND });
        }
        branchId = dto.branch_id;
      } else {
        branchId = null;
      }
    }

    const before = await this.currentSettings(section);
    const after: SectionSettings = {
      branch_id: branchId,
      class_type: dto.class_type ?? before.class_type,
      mode: dto.mode ?? before.mode,
      grace_minutes: dto.grace_minutes !== undefined ? dto.grace_minutes : before.grace_minutes,
    };
    if (after.branch_id !== section.branch_id) await this.sections.setBranch(section, after.branch_id, userId);
    await this.saveSettings(this.settingsRepo.manager, section, after, userId);
    const diff = auditChanges(before, after);
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.SECTION_ATTENDANCE_UPDATE,
        organizationId,
        actorId: userId,
        entityType: 'section',
        entityId: section.id,
        before: diff.before,
        after: diff.after,
      });
    }
    return this.rowOf(tenant, userId, section.id);
  }

  async replaceSlots(tenant: Tenant, userId: string, sectionId: string, slots: SlotDto[]): Promise<SectionSetupView> {
    const section = await this.editableSection(tenant, userId, sectionId);
    const inputs = slots.map((slot) => ({ ...slot, teacher_id: slot.teacher_id ?? null }));
    await this.assertTeachers(tenant.organizationId, inputs);
    const result = await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, tenant.organizationId);
      return this.slots.replace(manager, section, inputs, userId);
    });
    if (result.changed) this.audit.record(this.scheduleAudit(section, userId, result.before, result.after, 'grid'));
    return this.rowOf(tenant, userId, section.id);
  }

  /**
   * Applies one section's schedule (teachers are not copied) and, if asked, its class type, mode and
   * grace period to every other section of a class or a shift in the same session, in one
   * transaction. `dry_run` only lists the sections that would be replaced.
   */
  async apply(tenant: Tenant, userId: string, dto: ApplyScheduleDto): Promise<ApplyResult> {
    if (!isManager(tenant)) throw new ForbiddenException("Teachers can't apply a schedule to many sections");
    if (Boolean(dto.class_id) === Boolean(dto.shift)) {
      throw new BadRequestException({ message: 'Choose a class or a shift', code: ATTENDANCE_ERRORS.SETUP_TARGET_INVALID });
    }
    const organizationId = tenant.organizationId;
    const source = await this.sections.findSectionWithClass(dto.from_section_id);
    this.sessions.assertSessionOpen(source.session);
    const { sections } = await this.sections.listWithClasses(source.session_id);
    const targets = sections.filter(
      (section) => section.id !== source.id && (dto.class_id ? section.class_id === dto.class_id : section.shift === dto.shift),
    );
    const slots = await this.slots.activeBySection(organizationId, [source.id, ...targets.map((t) => t.id)]);
    const sourceSlots = withoutTeachers(slots.get(source.id) ?? []);
    const result: ApplyResult = {
      dry_run: Boolean(dto.dry_run),
      sections: targets.map((target) => ({
        id: target.id,
        name: target.name,
        class_name: target.class.class_name,
        // Settings only: no periods are replaced.
        slots_before: dto.include_schedule === false ? 0 : (slots.get(target.id)?.length ?? 0),
        teachers_dropped: dto.include_schedule === false ? 0 : (slots.get(target.id) ?? []).filter((slot) => slot.teacher_id).length,
      })),
    };
    if (dto.dry_run || targets.length === 0) return result;

    const sourceSettings = await this.currentSettings(source);
    const entries: AuditEntry[] = [];
    await this.dataSource.transaction(async (manager) => {
      await this.slots.lockOrganization(manager, organizationId);
      for (const target of targets) {
        if (dto.include_schedule !== false) {
          const changed = await this.slots.replace(manager, target, sourceSlots, userId);
          if (changed.changed) entries.push(this.scheduleAudit(target, userId, changed.before, changed.after, 'apply', source.id));
        }
        if (dto.include_settings) {
          const before = await this.currentSettings(target, manager);
          const after = { ...before, class_type: sourceSettings.class_type, mode: sourceSettings.mode, grace_minutes: sourceSettings.grace_minutes };
          await this.saveSettings(manager, target, after, userId);
          const diff = auditChanges(before, after);
          if (diff.after) {
            entries.push({
              action: AUDIT_ACTIONS.SECTION_ATTENDANCE_UPDATE,
              organizationId,
              actorId: userId,
              entityType: 'section',
              entityId: target.id,
              before: diff.before,
              after: diff.after,
            });
          }
        }
      }
    });
    if (entries.length > 0) this.audit.recordMany(entries);
    return result;
  }

  /** A section the caller may change, in an open session (404 for another organisation's). */
  private async editableSection(tenant: Tenant, userId: string, sectionId: string): Promise<SectionEntity> {
    const section = await this.sections.findSectionWithClass(sectionId);
    this.sessions.assertSessionOpen(section.session);
    const editable = await this.editableSectionIds(tenant, userId, section.session_id);
    if (editable !== 'all' && !editable.has(section.id)) {
      throw new ForbiddenException('You can set up only the sections you teach');
    }
    return section;
  }

  /** Sections of the session the caller may set up: 'all' for owners, admins and assistants. */
  async editableSectionIds(tenant: Tenant, userId: string, sessionId: string): Promise<'all' | Set<string>> {
    if (isManager(tenant)) return 'all';
    return this.sections.sectionIdsTaughtBy(tenant.organizationId, sessionId, userId);
  }

  /** Slot teachers must be teaching members of the organisation. */
  private async assertTeachers(organizationId: string, slots: SlotInput[]): Promise<void> {
    const teacherIds = [...new Set(slots.map((slot) => slot.teacher_id).filter((id): id is string => Boolean(id)))];
    for (const teacherId of teacherIds) {
      const membership = await this.access.getMembership(organizationId, teacherId);
      if (!this.access.isAssignableTeachingRole(membership?.role)) {
        throw new BadRequestException({
          message: 'The teacher must be a teaching member of this organisation',
          code: ATTENDANCE_ERRORS.SETUP_TEACHER_INVALID,
          details: { slot: slots.findIndex((slot) => slot.teacher_id === teacherId) },
        });
      }
    }
  }

  private async rowOf(tenant: Tenant, userId: string, sectionId: string): Promise<SectionSetupView> {
    const section = await this.sections.findSectionWithClass(sectionId);
    const view = await this.grid(tenant, userId, section.session_id);
    const row = view.sections.find((s) => s.id === sectionId);
    if (!row) throw new NotFoundException('Section not found');
    return row;
  }

  async settingsBySection(organizationId: string, sectionIds: string[], manager?: EntityManager) {
    if (sectionIds.length === 0) return new Map<string, SectionAttendanceSettingsEntity>();
    const rows = await (manager ?? this.settingsRepo.manager)
      .getRepository(SectionAttendanceSettingsEntity)
      .find({ where: { organization_id: organizationId, section_id: In(sectionIds) } });
    return new Map(rows.map((row) => [row.section_id, row]));
  }

  private async currentSettings(section: SectionEntity, manager?: EntityManager): Promise<SectionSettings> {
    const own = (await this.settingsBySection(section.organization_id, [section.id], manager)).get(section.id);
    return {
      branch_id: section.branch_id,
      class_type: own?.class_type ?? SectionClassTypeEnum.IN_PERSON,
      mode: own?.mode ?? SectionAttendanceModeEnum.SELF_CHECKIN,
      grace_minutes: own?.grace_minutes ?? null,
    };
  }

  /** Creates the section's settings row on the first change; the branch lives on the section itself. */
  async saveSettings(manager: EntityManager, section: SectionEntity, settings: SectionSettings, userId: string): Promise<void> {
    const repo = manager.getRepository(SectionAttendanceSettingsEntity);
    const fields = { class_type: settings.class_type, mode: settings.mode, grace_minutes: settings.grace_minutes };
    const existing = await repo.findOne({ where: { organization_id: section.organization_id, section_id: section.id } });
    if (existing) {
      if (existing.class_type === fields.class_type && existing.mode === fields.mode && existing.grace_minutes === fields.grace_minutes) return;
      await repo.update({ id: existing.id }, { ...fields, updated_by: userId, updated_at: new Date() });
      return;
    }
    await repo
      .createQueryBuilder()
      .insert()
      .values({ ...fields, organization_id: section.organization_id, section_id: section.id, created_by: userId, created_at: new Date() })
      .orUpdate(['class_type', 'mode', 'grace_minutes'], ['section_id'])
      .execute();
  }

  scheduleAudit(
    section: Pick<SectionEntity, 'id' | 'organization_id'>,
    userId: string,
    before: SlotInput[],
    after: SlotInput[],
    source: ScheduleSource,
    fromSectionId?: string,
  ): AuditEntry {
    return {
      action: AUDIT_ACTIONS.SCHEDULE_UPDATE,
      organizationId: section.organization_id,
      actorId: userId,
      entityType: 'section',
      entityId: section.id,
      before: { slots: before },
      after: { slots: after, source, ...(fromSectionId ? { from_section_id: fromSectionId } : {}) },
    };
  }
}

/** Owners, admins and assistants set up every section, move sections between branches and change many at once. */
export const isManager = (tenant: Tenant) => !tenant.viaEnrolment && SETUP_MANAGERS.includes(tenant.memberRole);

const withoutTeachers = (slots: SlotInput[]): SlotInput[] =>
  slots.map((slot) => ({ day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time, teacher_id: null }));
