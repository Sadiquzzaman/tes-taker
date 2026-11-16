import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { BranchEntity } from './entities/branch.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';
import { OrgSettingsService } from './org-settings.service';

/** Fields of a branch another module may set; the attendance module validates them first. */
export type BranchFields = Partial<Pick<BranchEntity, 'name' | 'address' | 'geo_lat' | 'geo_lng' | 'checkin_radius_m'>>;

/**
 * Storage of an organisation's branches (ATT-15; `branches` belongs to the organisations module).
 * Every organisation has one hidden default branch: the migration created it for existing
 * organisations and `defaultBranch` creates it on first use for new ones. No access checks here;
 * the attendance module checks who may change what.
 */
@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    private readonly orgSettings: OrgSettingsService,
  ) {}

  /** The organisation's default branch, created if it does not exist yet (safe when two requests race). */
  async defaultBranch(organizationId: string, manager?: EntityManager): Promise<BranchEntity> {
    const repo = (manager ?? this.branchRepo.manager).getRepository(BranchEntity);
    const existing = await repo.findOne({ where: { organization_id: organizationId, is_default: true } });
    if (existing) return existing;
    await repo
      .createQueryBuilder()
      .insert()
      .into(BranchEntity)
      .values({ organization_id: organizationId, is_default: true, created_at: new Date() })
      .orIgnore()
      .execute();
    return repo.findOneOrFail({ where: { organization_id: organizationId, is_default: true } });
  }

  /** Active branches of an organisation: the default branch first, then by name. */
  async listActive(organizationId: string): Promise<BranchEntity[]> {
    await this.defaultBranch(organizationId);
    return tenantScoped(this.branchRepo)
      .forOrganization(organizationId)
      .createQueryBuilder('b')
      .andWhere('b.is_active = :active', { active: ActiveStatusEnum.ACTIVE })
      .orderBy('b.is_default', 'DESC')
      .addOrderBy('lower(b.name)', 'ASC')
      .getMany();
  }

  /** An active branch of the organisation, or null (another organisation's id is never found). */
  findActive(organizationId: string, id: string): Promise<BranchEntity | null> {
    return tenantScoped(this.branchRepo)
      .forOrganization(organizationId)
      .findOne({ where: { id, is_active: ActiveStatusEnum.ACTIVE } });
  }

  /** A new branch; adding one switches branches on for the organisation (P12-01). */
  async create(organizationId: string, fields: BranchFields, userId: string): Promise<BranchEntity> {
    const saved = await this.branchRepo.save(
      this.branchRepo.create({ ...fields, organization_id: organizationId, is_default: false, created_by: userId, created_at: new Date() }),
    );
    await this.orgSettings.enableBranches(organizationId, userId);
    return saved;
  }

  /** Active branch managers of a branch (P12-01): a branch with one cannot be removed. */
  async countManagers(organizationId: string, branchId: string): Promise<number> {
    return this.branchRepo.manager.getRepository(OrganizationMemberEntity).count({
      where: { organization_id: organizationId, branch_id: branchId, role: OrganizationMemberRoleEnum.BRANCH_MANAGER, is_active: ActiveStatusEnum.ACTIVE },
    });
  }

  async update(branch: BranchEntity, fields: BranchFields, userId: string): Promise<BranchEntity> {
    Object.assign(branch, fields, { updated_by: userId, updated_at: new Date() });
    return this.branchRepo.save(branch);
  }

  /** Soft delete: the row stays with who removed it and when. The default branch is never removed. */
  async remove(branch: BranchEntity, userId: string): Promise<void> {
    await this.branchRepo.update(
      { id: branch.id, organization_id: branch.organization_id, is_default: false },
      { is_active: ActiveStatusEnum.INACTIVE, removed_at: new Date(), removed_by: userId, updated_by: userId, updated_at: new Date() },
    );
  }
}
