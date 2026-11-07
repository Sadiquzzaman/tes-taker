import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { schoolDateIn } from 'src/common/utils/school-date.util';
import { DEFAULT_GUARDIAN_SMS, GuardianSmsSwitches, OrgSettingsEntity, WeeklyOffDaysChange } from './entities/org-settings.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationKindEnum } from './enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationAccessService } from './organization-access.service';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';
import { UpdateLevelLabelsDto } from './dto/update-level-labels.dto';
import { buildLevelLabels, DEFAULT_LEVEL_LABELS, LevelLabels, resolveLevelLabels } from './level-labels';

export const ORGANIZATION_LOCALES = ['bn', 'en'] as const;

/** Earlier weekly off days kept (a change a week; far more than the closing job's 7-day catch-up needs). */
const MAX_WEEKLY_OFF_DAYS_HISTORY = 100;
export type OrganizationLocale = (typeof ORGANIZATION_LOCALES)[number];

export interface OrgSettingsView {
  organization_id: string;
  class_teacher_enabled: boolean;
  /** Language for members who have not chosen one (organizations.default_locale, FND-18). */
  default_locale: OrganizationLocale;
  /** When the academic setup wizard was finished (P2-04); null = not yet. */
  setup_completed_at: Date | null;
  /** Guardian SMS language (FND-10): the organisation's choice, else its default language. */
  sms_locale: OrganizationLocale;
}

/**
 * Organisation attendance settings as stored (ATT-01 as changed on 5 Nov 2026). Class times come
 * from each section's schedule; the pin and radius live on the organisation's branches (ATT-15).
 */
export interface AttendanceSettings {
  /** Minutes after a class starts before a check-in is Late (ATT-06); a section can override it. */
  late_grace_minutes: number;
  /** ISO day numbers (1 = Monday … 7 = Sunday), ascending. */
  weekly_off_days: number[];
  guardian_sms: GuardianSmsSwitches;
  repeat_absence_days: number;
}

/** Organisation homework settings as stored (Epic 2 settings table). */
export interface HomeworkSettings {
  late_allowed: boolean;
  late_penalty: { type: 'NONE' | 'PER_DAY' | 'FIXED'; percent: number };
  resubmissions: number;
  max_files: number;
}

/** The spec's defaults (Epic 2 settings table), used while an organisation has no row. */
export const DEFAULT_HOMEWORK_SETTINGS: HomeworkSettings = {
  late_allowed: true,
  late_penalty: { type: 'NONE', percent: 0 },
  resubmissions: 1,
  max_files: 5,
};

/** The spec's defaults (Epic 1 settings table), used while an organisation has no row. */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  late_grace_minutes: 10,
  weekly_off_days: [5],
  guardian_sms: DEFAULT_GUARDIAN_SMS,
  repeat_absence_days: 3,
};

/**
 * Per-organisation settings (org_settings, design §9.1). An organisation without a row uses the
 * defaults for its kind; the row is created on the first change. The default language and the
 * level names live on the organisation itself.
 */
@Injectable()
export class OrgSettingsService {
  constructor(
    @InjectRepository(OrgSettingsEntity)
    private readonly settingsRepo: Repository<OrgSettingsEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    private readonly accessService: OrganizationAccessService,
  ) {}

  /** Class teachers are on for schools and coaching centres, off for a solo teacher's workspace. */
  static defaultsFor(kind: OrganizationKindEnum): Pick<OrgSettingsView, 'class_teacher_enabled'> {
    return { class_teacher_enabled: kind !== OrganizationKindEnum.SOLO };
  }

  async getForMember(organizationId: string, userId: string): Promise<OrgSettingsView> {
    await this.accessService.requireApprovedMember(organizationId, userId);
    return this.get(organizationId);
  }

  async updateForManager(organizationId: string, userId: string, dto: UpdateOrgSettingsDto): Promise<OrgSettingsView> {
    await this.accessService.requireApprovedOwnerOrAdmin(organizationId, userId);
    if (dto.default_locale !== undefined) {
      await this.organizationRepo.update(
        { id: organizationId },
        { default_locale: dto.default_locale, updated_by: userId, updated_at: new Date() },
      );
    }
    if (dto.class_teacher_enabled !== undefined || dto.sms_locale !== undefined) {
      const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
      const row =
        existing ??
        this.settingsRepo.create({
          organization_id: organizationId,
          ...OrgSettingsService.defaultsFor((await this.organization(organizationId)).kind),
          created_by: userId,
          created_at: new Date(),
        });
      if (dto.class_teacher_enabled !== undefined) row.class_teacher_enabled = dto.class_teacher_enabled;
      if (dto.sms_locale !== undefined) row.sms_locale = dto.sms_locale;
      if (existing) {
        row.updated_by = userId;
        row.updated_at = new Date();
      }
      await this.settingsRepo.save(row);
    }
    return this.get(organizationId);
  }

  /** The organisation's settings (no access check; callers have already checked). */
  async get(organizationId: string, manager?: EntityManager): Promise<OrgSettingsView> {
    const em = manager ?? this.settingsRepo.manager;
    const organization = await this.organization(organizationId, em);
    const row = await em.getRepository(OrgSettingsEntity).findOne({ where: { organization_id: organizationId } });
    const defaultLocale: OrganizationLocale = organization.default_locale === 'en' ? 'en' : 'bn';
    return {
      organization_id: organizationId,
      class_teacher_enabled: row ? row.class_teacher_enabled : OrgSettingsService.defaultsFor(organization.kind).class_teacher_enabled,
      default_locale: defaultLocale,
      setup_completed_at: row?.setup_completed_at ?? null,
      sms_locale: row?.sms_locale === 'bn' || row?.sms_locale === 'en' ? row.sms_locale : defaultLocale,
    };
  }

  /**
   * Records that the academic setup is finished (the academics module checks the structure first).
   * Finishing again keeps the first time.
   */
  async markSetupComplete(organizationId: string, userId: string): Promise<OrgSettingsView> {
    const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
    if (!existing) {
      await this.settingsRepo.save(
        this.settingsRepo.create({
          organization_id: organizationId,
          ...OrgSettingsService.defaultsFor((await this.organization(organizationId)).kind),
          setup_completed_at: new Date(),
          created_by: userId,
          created_at: new Date(),
        }),
      );
    } else if (!existing.setup_completed_at) {
      await this.settingsRepo.update(
        { organization_id: organizationId },
        { setup_completed_at: new Date(), updated_by: userId, updated_at: new Date() },
      );
    }
    return this.get(organizationId);
  }

  /** The organisation's time zone (school days are dates in it, design §8.9). */
  /** Earlier weekly off days, oldest first (see `OrgSettingsEntity.weekly_off_days_history`). */
  async weeklyOffDaysHistory(organizationId: string): Promise<WeeklyOffDaysChange[]> {
    const row = await this.settingsRepo.findOne({ where: { organization_id: organizationId }, select: { id: true, weekly_off_days_history: true } });
    return row?.weekly_off_days_history ?? [];
  }

  async timeZone(organizationId: string): Promise<string> {
    return (await this.organization(organizationId)).timezone || 'Asia/Dhaka';
  }

  /** The organisation's name (shown in guardian SMS so families know who sent it). */
  async organizationName(organizationId: string): Promise<string> {
    return (await this.organization(organizationId)).name;
  }

  /** The organisation's kind (a school or coaching centre, or a solo teacher's workspace). */
  async kind(organizationId: string): Promise<OrganizationEntity['kind']> {
    return (await this.organization(organizationId)).kind;
  }

  /** The organisation's attendance settings (no access check; the attendance module checks). */
  async getAttendance(organizationId: string, manager?: EntityManager): Promise<AttendanceSettings> {
    const em = manager ?? this.settingsRepo.manager;
    const row = await em.getRepository(OrgSettingsEntity).findOne({ where: { organization_id: organizationId } });
    return row ? attendanceOf(row) : { ...DEFAULT_ATTENDANCE_SETTINGS, guardian_sms: { ...DEFAULT_GUARDIAN_SMS } };
  }

  /**
   * Saves attendance settings the attendance module has already validated, creating the row on the
   * first change. Returns the settings before and after.
   */
  async saveAttendance(
    organizationId: string,
    userId: string,
    changes: Partial<AttendanceSettings>,
    /** The organisation's date now; a change of weekly off days is recorded as of it. */
    today?: string,
  ): Promise<{ before: AttendanceSettings; after: AttendanceSettings }> {
    const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
    const before = existing ? attendanceOf(existing) : await this.getAttendance(organizationId);
    const row =
      existing ??
      this.settingsRepo.create({
        organization_id: organizationId,
        ...OrgSettingsService.defaultsFor((await this.organization(organizationId)).kind),
        created_by: userId,
        created_at: new Date(),
      });
    if (changes.weekly_off_days && changes.weekly_off_days.join() !== before.weekly_off_days.join()) {
      // Remember the off days being replaced and the last date they applied to, so a day opened
      // now stays closed on the dates it already covered (attendance never reaches back).
      const until = today ?? schoolDateIn(await this.timeZone(organizationId));
      row.weekly_off_days_history = [...(row.weekly_off_days_history ?? []), { days: before.weekly_off_days, until }].slice(
        -MAX_WEEKLY_OFF_DAYS_HISTORY,
      );
    }
    Object.assign(row, changes);
    if (existing) {
      row.updated_by = userId;
      row.updated_at = new Date();
    }
    const saved = await this.settingsRepo.save(row);
    return { before, after: attendanceOf(saved) };
  }

  async getHomework(organizationId: string): Promise<HomeworkSettings> {
    const row = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
    return row ? homeworkOf(row) : { ...DEFAULT_HOMEWORK_SETTINGS, late_penalty: { ...DEFAULT_HOMEWORK_SETTINGS.late_penalty } };
  }

  /** Saves homework settings the homework module has already validated; creates the row on the first change. */
  async saveHomework(organizationId: string, userId: string, changes: Partial<HomeworkSettings>): Promise<{ before: HomeworkSettings; after: HomeworkSettings }> {
    const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
    const before = existing ? homeworkOf(existing) : await this.getHomework(organizationId);
    const row =
      existing ??
      this.settingsRepo.create({
        organization_id: organizationId,
        ...OrgSettingsService.defaultsFor((await this.organization(organizationId)).kind),
        created_by: userId,
        created_at: new Date(),
      });
    if (changes.late_allowed !== undefined) row.homework_late_allowed = changes.late_allowed;
    if (changes.late_penalty) {
      row.homework_late_penalty_type = changes.late_penalty.type;
      row.homework_late_penalty_percent = changes.late_penalty.type === 'NONE' ? 0 : changes.late_penalty.percent;
    }
    if (changes.resubmissions !== undefined) row.homework_resubmissions = changes.resubmissions;
    if (changes.max_files !== undefined) row.homework_max_files = changes.max_files;
    if (existing) {
      row.updated_by = userId;
      row.updated_at = new Date();
    }
    const saved = await this.settingsRepo.save(row);
    return { before, after: homeworkOf(saved) };
  }

  /**
   * The level names of the request's workspace (FND-03). Anyone signed in may read them; without
   * a workspace (a student who has not chosen a teacher yet) they are Class / Section.
   */
  async currentLevelLabels(): Promise<LevelLabels> {
    const tenant = TenantContext.current();
    if (!tenant) return DEFAULT_LEVEL_LABELS;
    return resolveLevelLabels((await this.organization(tenant.organizationId)).level_labels);
  }

  /** Renames the levels of the request's workspace: its Owner only (a solo teacher owns theirs). */
  async updateCurrentLevelLabels(userId: string, dto: UpdateLevelLabelsDto): Promise<LevelLabels> {
    const tenant = TenantContext.current();
    if (!tenant || tenant.viaEnrolment || tenant.memberRole !== OrganizationMemberRoleEnum.OWNER) {
      throw new ForbiddenException('Only the owner can rename classes and sections');
    }
    const labels = buildLevelLabels(dto.preset, dto);
    if (!labels) {
      throw new BadRequestException('Enter a name for both levels in English (singular and plural) and Bangla');
    }
    await this.organizationRepo.update(
      { id: tenant.organizationId },
      { level_labels: labels, updated_by: userId, updated_at: new Date() },
    );
    return labels;
  }

  private organization(organizationId: string, manager?: EntityManager): Promise<OrganizationEntity> {
    return (manager ?? this.organizationRepo.manager).getRepository(OrganizationEntity).findOneOrFail({ where: { id: organizationId } });
  }
}

function attendanceOf(row: OrgSettingsEntity): AttendanceSettings {
  return {
    late_grace_minutes: row.late_grace_minutes ?? DEFAULT_ATTENDANCE_SETTINGS.late_grace_minutes,
    weekly_off_days: [...(row.weekly_off_days ?? DEFAULT_ATTENDANCE_SETTINGS.weekly_off_days)].map(Number).sort((a, b) => a - b),
    guardian_sms: { ...DEFAULT_GUARDIAN_SMS, ...(row.guardian_sms ?? {}) },
    repeat_absence_days: row.repeat_absence_days ?? DEFAULT_ATTENDANCE_SETTINGS.repeat_absence_days,
  };
}

function homeworkOf(row: OrgSettingsEntity): HomeworkSettings {
  return {
    late_allowed: row.homework_late_allowed ?? DEFAULT_HOMEWORK_SETTINGS.late_allowed,
    late_penalty: {
      type: row.homework_late_penalty_type ?? 'NONE',
      percent: row.homework_late_penalty_percent ?? 0,
    },
    resubmissions: row.homework_resubmissions ?? DEFAULT_HOMEWORK_SETTINGS.resubmissions,
    max_files: row.homework_max_files ?? DEFAULT_HOMEWORK_SETTINGS.max_files,
  };
}
