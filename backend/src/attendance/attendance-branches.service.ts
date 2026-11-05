import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { auditChanges } from 'src/audit/audit-sanitize';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { BranchesService, BranchFields } from 'src/organizations/branches.service';
import { BranchEntity } from 'src/organizations/entities/branch.entity';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { ATTENDANCE_ERRORS } from './attendance-errors';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

/** A branch as the API returns it. */
export interface BranchView {
  id: string;
  /** Null only for the main (default) branch while it has no name of its own. */
  name: string | null;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  checkin_radius_m: number;
  /** The organisation's hidden default ("main") branch: it holds the organisation's pin and cannot be removed. */
  is_default: boolean;
  /** Sections of open sessions that meet here (those without a branch count for the main branch). */
  section_count: number;
}

/**
 * Branches and their check-in pin and radius (ATT-15). Storage is the organisations module's
 * (`BranchesService`); this service owns the rules: names are unique, a pin is both coordinates or
 * none, the main branch is never removed, a branch still used by sections of an open session is not
 * removed, and a solo teacher has only the main branch. Removing keeps the row.
 */
@Injectable()
export class AttendanceBranchesService {
  constructor(
    private readonly branches: BranchesService,
    private readonly sections: SectionsService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<BranchView[]> {
    const [branches, counts] = await Promise.all([
      this.branches.listActive(organizationId),
      this.sections.countOpenSectionsByBranch(organizationId),
    ]);
    return branches.map((branch) => view(branch, counts));
  }

  async create(tenant: Tenant, userId: string, dto: CreateBranchDto): Promise<BranchView> {
    const organizationId = tenant.organizationId;
    if (tenant.kind === OrganizationKindEnum.SOLO) {
      throw new BadRequestException({
        message: "A solo teacher's workspace has one location; set its pin in the attendance settings",
        code: ATTENDANCE_ERRORS.BRANCHES_NOT_FOR_SOLO,
      });
    }
    const main = await this.branches.defaultBranch(organizationId);
    const fields = this.validFields(dto, null);
    fields.checkin_radius_m ??= main.checkin_radius_m;
    await this.assertNameFree(organizationId, fields.name ?? null, null);
    const saved = await this.branches.create(organizationId, fields, userId);
    this.audit.record({
      action: AUDIT_ACTIONS.BRANCH_CREATE,
      organizationId,
      actorId: userId,
      entityType: 'branch',
      entityId: saved.id,
      after: state(saved),
    });
    return view(saved, new Map());
  }

  async update(tenant: Tenant, userId: string, id: string, dto: UpdateBranchDto): Promise<BranchView> {
    const organizationId = tenant.organizationId;
    const branch = await this.findActive(organizationId, id);
    const before = state(branch);
    const fields = this.validFields(dto, branch);
    if (fields.name !== undefined) await this.assertNameFree(organizationId, fields.name, branch.id);
    const saved = await this.branches.update(branch, fields, userId);
    const diff = auditChanges(before, state(saved));
    if (diff.after) {
      this.audit.record({
        action: AUDIT_ACTIONS.BRANCH_UPDATE,
        organizationId,
        actorId: userId,
        entityType: 'branch',
        entityId: saved.id,
        before: diff.before,
        after: diff.after,
      });
    }
    return view(saved, await this.sections.countOpenSectionsByBranch(organizationId));
  }

  /** Soft delete; sections of closed sessions keep pointing at the removed branch for their history. */
  async remove(tenant: Tenant, userId: string, id: string): Promise<void> {
    const organizationId = tenant.organizationId;
    const branch = await this.findActive(organizationId, id);
    if (branch.is_default) {
      throw new BadRequestException({ message: 'The main branch cannot be removed', code: ATTENDANCE_ERRORS.BRANCH_DEFAULT_KEPT });
    }
    const inUse = (await this.sections.countOpenSectionsByBranch(organizationId)).get(branch.id) ?? 0;
    if (inUse > 0) {
      throw new ConflictException({
        message: `${inUse} section(s) of an open session meet at this branch; move them to another branch first`,
        code: ATTENDANCE_ERRORS.BRANCH_IN_USE,
        details: { sections: inUse },
      });
    }
    await this.branches.remove(branch, userId);
    this.audit.record({
      action: AUDIT_ACTIONS.BRANCH_REMOVE,
      organizationId,
      actorId: userId,
      entityType: 'branch',
      entityId: branch.id,
      before: state(branch),
    });
  }

  private async findActive(organizationId: string, id: string): Promise<BranchEntity> {
    const branch = await this.branches.findActive(organizationId, id);
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  /** The fields to save, checked; `branch` is null for a new branch. */
  private validFields(dto: CreateBranchDto | UpdateBranchDto, branch: BranchEntity | null): BranchFields {
    const fields: BranchFields = {};
    if (dto.name !== undefined) {
      const name = dto.name || null;
      if (!name && !branch?.is_default) {
        throw new BadRequestException({ message: 'Enter a name for the branch', code: ATTENDANCE_ERRORS.BRANCH_NAME_REQUIRED });
      }
      fields.name = name;
    }
    if (dto.address !== undefined) fields.address = dto.address || null;
    if (dto.geo_lat !== undefined || dto.geo_lng !== undefined) {
      const lat = dto.geo_lat ?? null;
      const lng = dto.geo_lng ?? null;
      if ((lat === null) !== (lng === null)) {
        throw new BadRequestException({
          message: 'A pin needs both latitude and longitude',
          code: ATTENDANCE_ERRORS.BRANCH_PIN_INCOMPLETE,
        });
      }
      fields.geo_lat = lat === null ? null : Number(lat).toFixed(6);
      fields.geo_lng = lng === null ? null : Number(lng).toFixed(6);
    }
    if (dto.checkin_radius_m !== undefined) fields.checkin_radius_m = dto.checkin_radius_m;
    return fields;
  }

  private async assertNameFree(organizationId: string, name: string | null, exceptId: string | null): Promise<void> {
    if (!name) return;
    const taken = (await this.branches.listActive(organizationId)).some(
      (other) => other.id !== exceptId && other.name?.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (taken) {
      throw new ConflictException({ message: 'Another branch already has this name', code: ATTENDANCE_ERRORS.BRANCH_NAME_TAKEN });
    }
  }
}

function view(branch: BranchEntity, sectionCounts: Map<string | null, number>): BranchView {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    geo_lat: branch.geo_lat === null ? null : Number(branch.geo_lat),
    geo_lng: branch.geo_lng === null ? null : Number(branch.geo_lng),
    checkin_radius_m: branch.checkin_radius_m,
    is_default: branch.is_default,
    section_count: (sectionCounts.get(branch.id) ?? 0) + (branch.is_default ? (sectionCounts.get(null) ?? 0) : 0),
  };
}

function state(branch: BranchEntity) {
  return {
    name: branch.name,
    address: branch.address,
    geo_lat: branch.geo_lat === null ? null : Number(branch.geo_lat),
    geo_lng: branch.geo_lng === null ? null : Number(branch.geo_lng),
    checkin_radius_m: branch.checkin_radius_m,
  };
}
