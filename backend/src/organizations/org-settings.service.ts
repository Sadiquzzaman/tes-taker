import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrgSettingsEntity } from './entities/org-settings.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationKindEnum } from './enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrganizationAccessService } from './organization-access.service';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';
import { UpdateLevelLabelsDto } from './dto/update-level-labels.dto';
import { buildLevelLabels, DEFAULT_LEVEL_LABELS, LevelLabels, resolveLevelLabels } from './level-labels';

export const ORGANIZATION_LOCALES = ['bn', 'en'] as const;
export type OrganizationLocale = (typeof ORGANIZATION_LOCALES)[number];

export interface OrgSettingsView {
  organization_id: string;
  class_teacher_enabled: boolean;
  /** Language for members who have not chosen one (organizations.default_locale, FND-18). */
  default_locale: OrganizationLocale;
}

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
    if (dto.class_teacher_enabled !== undefined) {
      const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
      const row =
        existing ??
        this.settingsRepo.create({
          organization_id: organizationId,
          ...OrgSettingsService.defaultsFor((await this.organization(organizationId)).kind),
          created_by: userId,
          created_at: new Date(),
        });
      row.class_teacher_enabled = dto.class_teacher_enabled;
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
    return {
      organization_id: organizationId,
      class_teacher_enabled: row ? row.class_teacher_enabled : OrgSettingsService.defaultsFor(organization.kind).class_teacher_enabled,
      default_locale: organization.default_locale === 'en' ? 'en' : 'bn',
    };
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
