import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OrgSettingsEntity } from './entities/org-settings.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationKindEnum } from './enums/organization-kind.enum';
import { OrganizationAccessService } from './organization-access.service';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';

export interface OrgSettingsView {
  organization_id: string;
  class_teacher_enabled: boolean;
}

/**
 * Per-organisation settings (org_settings, design §9.1). An organisation without a row uses the
 * defaults for its kind; the row is created on the first change.
 */
@Injectable()
export class OrgSettingsService {
  constructor(
    @InjectRepository(OrgSettingsEntity)
    private readonly settingsRepo: Repository<OrgSettingsEntity>,
    private readonly accessService: OrganizationAccessService,
  ) {}

  /** Class teachers are on for schools and coaching centres, off for a solo teacher's workspace. */
  static defaultsFor(kind: OrganizationKindEnum): Omit<OrgSettingsView, 'organization_id'> {
    return { class_teacher_enabled: kind !== OrganizationKindEnum.SOLO };
  }

  async getForMember(organizationId: string, userId: string): Promise<OrgSettingsView> {
    await this.accessService.requireApprovedMember(organizationId, userId);
    return this.get(organizationId);
  }

  async updateForManager(organizationId: string, userId: string, dto: UpdateOrgSettingsDto): Promise<OrgSettingsView> {
    await this.accessService.requireApprovedOwnerOrAdmin(organizationId, userId);
    const existing = await this.settingsRepo.findOne({ where: { organization_id: organizationId } });
    const row = existing ?? this.settingsRepo.create({ ...(await this.get(organizationId)), created_by: userId, created_at: new Date() });
    if (dto.class_teacher_enabled !== undefined) row.class_teacher_enabled = dto.class_teacher_enabled;
    if (existing) {
      row.updated_by = userId;
      row.updated_at = new Date();
    }
    await this.settingsRepo.save(row);
    return this.toView(row);
  }

  /** The organisation's settings (no access check; callers have already checked). */
  async get(organizationId: string, manager?: EntityManager): Promise<OrgSettingsView> {
    const em = manager ?? this.settingsRepo.manager;
    const row = await em.getRepository(OrgSettingsEntity).findOne({ where: { organization_id: organizationId } });
    if (row) return this.toView(row);
    const organization = await em.getRepository(OrganizationEntity).findOneOrFail({ where: { id: organizationId } });
    return { organization_id: organizationId, ...OrgSettingsService.defaultsFor(organization.kind) };
  }

  private toView(row: OrgSettingsEntity): OrgSettingsView {
    return { organization_id: row.organization_id, class_teacher_enabled: row.class_teacher_enabled };
  }
}
