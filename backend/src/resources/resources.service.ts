import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { OfferingRosterService } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { CreateResourceDto, ListResourcesQueryDto, UpdateResourceDto } from './dto/resource.dto';
import { ResourceFolderEntity } from './entities/resource-folder.entity';
import { ResourceShareEntity } from './entities/resource-share.entity';
import { ResourceViewEntity } from './entities/resource-view.entity';
import { ResourceEntity, ResourceTypeEnum } from './entities/resource.entity';
import { RESOURCE_ERRORS } from './resource-errors';

/** Owners, admins and staff members manage every resource; teachers their own. */
const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN, OrganizationMemberRoleEnum.ASSISTANT];

export interface ResourceView {
  id: string;
  type: ResourceTypeEnum;
  title: string;
  description: string | null;
  subject: { id: string; name: string } | null;
  folder_id: string | null;
  tags: string[];
  download_allowed: boolean;
  archived: boolean;
  /** FILE: `/files/:id/content`; LINK: the address. */
  url: string;
  file: { name: string; mime: string; size: number } | null;
  shares: { offering_id: string; label: string }[];
  created_by: { id: string; name: string };
  created_at: Date;
  can_edit?: boolean;
  /** Students: not opened yet (RES-04 "New"). */
  is_new?: boolean;
}

/**
 * The resource library (Epic 8, RES-01, RES-03 to RES-06): staff add files (uploads with purpose
 * RESOURCE) or links with title, description, subject, folder and tags, and share them with
 * subject classes; students see what is shared with their subject classes (not archived), with
 * "New" until they open it; whoever added it (or owners, admins and staff members) sees who opened
 * it and who has not. "View only" hides the download button (RES-05).
 */
@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(ResourceEntity) private readonly resources: Repository<ResourceEntity>,
    @InjectRepository(ResourceFolderEntity) private readonly folders: Repository<ResourceFolderEntity>,
    @InjectRepository(ResourceShareEntity) private readonly shares: Repository<ResourceShareEntity>,
    @InjectRepository(ResourceViewEntity) private readonly views: Repository<ResourceViewEntity>,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------ staff

  /** The subject classes the caller may share with: every open one (managers), or the ones they teach. */
  async shareOptions(tenant: Tenant, userId: string) {
    this.assertStaff(tenant);
    const ids = await this.shareableIds(tenant, userId);
    return (await this.sections.offeringsWithTeachers(tenant.organizationId, ids))
      .map(({ offering }) => ({ offering_id: offering.id, label: this.label(offering), subject: { id: offering.subject_id, name: offering.subject?.name ?? '' } }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  }

  /** Staff: their own resources and the ones shared with subject classes they teach (managers: all), newest first. */
  async list(tenant: Tenant, userId: string, query: ListResourcesQueryDto): Promise<ResourceView[]> {
    this.assertStaff(tenant);
    const qb = this.resources
      .createQueryBuilder('r')
      .where('r.organization_id = :org AND r.deleted_at IS NULL', { org: tenant.organizationId })
      .andWhere(query.archived ? 'r.archived_at IS NOT NULL' : 'r.archived_at IS NULL');
    if (!this.isManager(tenant)) {
      const taught = await this.sections.offeringIdsTaughtBy(tenant.organizationId, userId);
      qb.andWhere(
        new Brackets((w) => {
          w.where('r.created_by = :userId', { userId });
          if (taught.length) w.orWhere('EXISTS (SELECT 1 FROM resource_shares s WHERE s.resource_id = r.id AND s.offering_id = ANY(:taught))', { taught });
        }),
      );
    }
    if (query.folder_id === 'none') qb.andWhere('r.folder_id IS NULL');
    else if (query.folder_id) qb.andWhere('r.folder_id = :folder', { folder: query.folder_id });
    this.filters(qb, query);
    const rows = await qb.orderBy('r.created_at', 'DESC').take(300).getMany();
    return (await this.toViews(tenant, rows)).map((view, i) => ({ ...view, can_edit: this.canEdit(tenant, userId, rows[i]) }));
  }

  async create(tenant: Tenant, userId: string, dto: CreateResourceDto): Promise<ResourceView> {
    this.assertStaff(tenant);
    const source = await this.source(tenant, userId, dto.type, dto.file_id, dto.url);
    await this.checkSubject(tenant, dto.subject_id);
    await this.checkFolder(tenant, userId, dto.folder_id);
    const offeringIds = await this.checkShares(tenant, userId, dto.offering_ids ?? []);
    const saved = await this.dataSource.transaction(async (manager) => {
      const resource = await manager.getRepository(ResourceEntity).save(
        manager.getRepository(ResourceEntity).create({
          organization_id: tenant.organizationId,
          type: dto.type,
          title: dto.title,
          description: dto.description?.trim() || null,
          subject_id: dto.subject_id ?? null,
          folder_id: dto.folder_id ?? null,
          ...source,
          tags: this.cleanTags(dto.tags),
          download_allowed: dto.download_allowed ?? true,
          created_by: userId,
        }),
      );
      if (offeringIds.length) {
        await manager.getRepository(ResourceShareEntity).insert(offeringIds.map((offering_id) => ({ resource_id: resource.id, offering_id, organization_id: tenant.organizationId })));
      }
      return resource;
    });
    this.audit.record({ action: AUDIT_ACTIONS.RESOURCE_CREATE, organizationId: tenant.organizationId, actorId: userId, entityType: 'resource', entityId: saved.id, after: { title: saved.title, type: saved.type, shares: offeringIds.length } });
    return (await this.toViews(tenant, [saved]))[0];
  }

  async update(tenant: Tenant, userId: string, id: string, dto: UpdateResourceDto): Promise<ResourceView> {
    const resource = await this.findEditable(tenant, userId, id);
    if (dto.subject_id) await this.checkSubject(tenant, dto.subject_id);
    if (dto.folder_id) await this.checkFolder(tenant, resource.created_by, dto.folder_id);
    const offeringIds = dto.offering_ids ? await this.checkShares(tenant, userId, dto.offering_ids) : null;
    const before = { title: resource.title, archived: Boolean(resource.archived_at), download_allowed: resource.download_allowed };
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ResourceEntity).update(
        { id },
        {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.subject_id !== undefined ? { subject_id: dto.subject_id } : {}),
          ...(dto.folder_id !== undefined ? { folder_id: dto.folder_id } : {}),
          ...(dto.tags !== undefined ? { tags: this.cleanTags(dto.tags) } : {}),
          ...(dto.download_allowed !== undefined ? { download_allowed: dto.download_allowed } : {}),
          ...(dto.archived !== undefined ? { archived_at: dto.archived ? resource.archived_at ?? new Date() : null } : {}),
          updated_at: new Date(),
        },
      );
      if (offeringIds) {
        await manager.getRepository(ResourceShareEntity).delete({ resource_id: id });
        if (offeringIds.length) {
          await manager.getRepository(ResourceShareEntity).insert(offeringIds.map((offering_id) => ({ resource_id: id, offering_id, organization_id: tenant.organizationId })));
        }
      }
    });
    const updated = await this.resources.findOneByOrFail({ id });
    this.audit.record({
      action: AUDIT_ACTIONS.RESOURCE_UPDATE,
      organizationId: tenant.organizationId,
      actorId: userId,
      entityType: 'resource',
      entityId: id,
      before,
      after: { title: updated.title, archived: Boolean(updated.archived_at), download_allowed: updated.download_allowed, ...(offeringIds ? { shares: offeringIds.length } : {}) },
    });
    return { ...(await this.toViews(tenant, [updated]))[0], can_edit: true };
  }

  /** Deleting keeps the row (deleted_at, who); students stop seeing it. */
  async remove(tenant: Tenant, userId: string, id: string): Promise<void> {
    const resource = await this.findEditable(tenant, userId, id);
    await this.resources.update({ id }, { deleted_at: new Date(), deleted_by: userId });
    this.audit.record({ action: AUDIT_ACTIONS.RESOURCE_DELETE, organizationId: tenant.organizationId, actorId: userId, entityType: 'resource', entityId: id, before: { title: resource.title } });
  }

  /** Who opened it and who has not (RES-06): the students of the subject classes it is shared with. */
  async insights(tenant: Tenant, userId: string, id: string) {
    const resource = await this.findEditable(tenant, userId, id);
    const shareRows = await this.shares.find({ where: { resource_id: id } });
    const offerings = await this.sections.offeringsWithTeachers(tenant.organizationId, shareRows.map((s) => s.offering_id));
    const students = new Map<string, { student_id: string; full_name: string; via: string }>();
    for (const { offering } of offerings) {
      for (const s of await this.roster.students(offering)) {
        if (!students.has(s.student_id)) students.set(s.student_id, { student_id: s.student_id, full_name: s.full_name, via: this.label(offering) });
      }
    }
    const seen = new Map((await this.views.find({ where: { resource_id: resource.id } })).map((v) => [v.student_id, v]));
    const all = [...students.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
    return {
      students: all.length,
      opened: all.filter((s) => seen.has(s.student_id)).map((s) => ({ ...s, first_opened_at: seen.get(s.student_id)!.first_opened_at, last_opened_at: seen.get(s.student_id)!.last_opened_at, opens: seen.get(s.student_id)!.opens })),
      not_opened: all.filter((s) => !seen.has(s.student_id)),
    };
  }

  // ------------------------------------------------------------------ folders

  async listFolders(tenant: Tenant, userId: string) {
    this.assertStaff(tenant);
    const rows = await this.folders.find({ where: { organization_id: tenant.organizationId, owner_id: userId, deleted_at: IsNull() }, order: { name: 'ASC' } });
    return rows.map((f) => ({ id: f.id, name: f.name }));
  }

  async createFolder(tenant: Tenant, userId: string, name: string) {
    this.assertStaff(tenant);
    const folder = await this.folders.save(this.folders.create({ organization_id: tenant.organizationId, owner_id: userId, name }));
    return { id: folder.id, name: folder.name };
  }

  async renameFolder(tenant: Tenant, userId: string, id: string, name: string) {
    const folder = await this.ownFolder(tenant, userId, id);
    await this.folders.update({ id: folder.id }, { name, updated_at: new Date() });
    return { id: folder.id, name };
  }

  /** The folder goes (kept as deleted); its resources move out of it. */
  async removeFolder(tenant: Tenant, userId: string, id: string): Promise<void> {
    const folder = await this.ownFolder(tenant, userId, id);
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ResourceEntity).update({ folder_id: folder.id }, { folder_id: null });
      await manager.getRepository(ResourceFolderEntity).update({ id: folder.id }, { deleted_at: new Date(), deleted_by: userId });
    });
  }

  // ------------------------------------------------------------------ students

  /** A student's resources (RES-04): shared with subject classes they take, not archived, newest first. */
  async mine(tenant: Tenant, userId: string, query: ListResourcesQueryDto): Promise<ResourceView[]> {
    const offeringIds = await this.roster.offeringIdsOfStudent(tenant.organizationId, userId);
    if (offeringIds.length === 0) return [];
    const qb = this.resources
      .createQueryBuilder('r')
      .where('r.organization_id = :org AND r.deleted_at IS NULL AND r.archived_at IS NULL', { org: tenant.organizationId })
      .andWhere('EXISTS (SELECT 1 FROM resource_shares s WHERE s.resource_id = r.id AND s.offering_id = ANY(:mine))', { mine: offeringIds });
    this.filters(qb, query);
    const rows = await qb.orderBy('r.created_at', 'DESC').take(300).getMany();
    const opened = new Set((rows.length ? await this.views.find({ where: { student_id: userId, resource_id: In(rows.map((r) => r.id)) } }) : []).map((v) => v.resource_id));
    // Students see only the classes of theirs it is shared with.
    return (await this.toViews(tenant, rows, offeringIds)).map((view) => ({ ...view, is_new: !opened.has(view.id) }));
  }

  /** A student opens a resource: counted for "New" and the insights; returns where it is. */
  async open(tenant: Tenant, userId: string, id: string): Promise<ResourceView> {
    const offeringIds = await this.roster.offeringIdsOfStudent(tenant.organizationId, userId);
    const resource = await this.resources
      .createQueryBuilder('r')
      .where('r.id = :id AND r.organization_id = :org AND r.deleted_at IS NULL AND r.archived_at IS NULL', { id, org: tenant.organizationId })
      .andWhere('EXISTS (SELECT 1 FROM resource_shares s WHERE s.resource_id = r.id AND s.offering_id = ANY(:mine))', { mine: offeringIds.length ? offeringIds : ['00000000-0000-0000-0000-000000000000'] })
      .getOne();
    if (!resource) this.notFound();
    await this.dataSource.query(
      `INSERT INTO resource_views (resource_id, student_id, organization_id) VALUES ($1, $2, $3)
       ON CONFLICT (resource_id, student_id) DO UPDATE SET last_opened_at = now(), opens = resource_views.opens + 1`,
      [id, userId, tenant.organizationId],
    );
    return { ...(await this.toViews(tenant, [resource], offeringIds))[0], is_new: false };
  }

  // ------------------------------------------------------------------ helpers

  private isManager(tenant: Tenant): boolean {
    return MANAGERS.includes(tenant.memberRole);
  }

  private assertStaff(tenant: Tenant): void {
    if (tenant.memberRole === OrganizationMemberRoleEnum.STUDENT || tenant.viaEnrolment) {
      throw new ForbiddenException({ message: 'Only staff manage the library', code: RESOURCE_ERRORS.STAFF_ONLY });
    }
  }

  private canEdit(tenant: Tenant, userId: string, resource: ResourceEntity): boolean {
    return this.isManager(tenant) || resource.created_by === userId;
  }

  private async findEditable(tenant: Tenant, userId: string, id: string): Promise<ResourceEntity> {
    this.assertStaff(tenant);
    const resource = await this.resources.findOne({ where: { id, organization_id: tenant.organizationId, deleted_at: IsNull() } });
    if (!resource) this.notFound();
    if (!this.canEdit(tenant, userId, resource)) {
      throw new ForbiddenException({ message: 'Only the person who added it can change it', code: RESOURCE_ERRORS.NOT_YOURS });
    }
    return resource;
  }

  private async shareableIds(tenant: Tenant, userId: string): Promise<string[]> {
    return this.isManager(tenant) ? this.sections.openOfferingIds(tenant.organizationId) : this.sections.offeringIdsTaughtBy(tenant.organizationId, userId);
  }

  private async checkShares(tenant: Tenant, userId: string, offeringIds: string[]): Promise<string[]> {
    const wanted = [...new Set(offeringIds)];
    if (wanted.length === 0) return [];
    const allowed = new Set(await this.shareableIds(tenant, userId));
    if (wanted.some((id) => !allowed.has(id))) {
      throw new ForbiddenException({ message: 'You can share only with subject classes you teach', code: RESOURCE_ERRORS.SHARE_NOT_ALLOWED });
    }
    return wanted;
  }

  /** A FILE is the caller's own upload for resources; a LINK an http(s) address. */
  private async source(tenant: Tenant, userId: string, type: ResourceTypeEnum, fileId?: string, url?: string): Promise<{ file_id: string | null; url: string | null }> {
    if (type === ResourceTypeEnum.LINK) {
      const address = (url ?? '').trim();
      let ok = false;
      try {
        ok = ['http:', 'https:'].includes(new URL(address).protocol);
      } catch {
        ok = false;
      }
      if (!ok) throw new BadRequestException({ message: 'Give a web address starting with http:// or https://', code: RESOURCE_ERRORS.URL_INVALID });
      return { file_id: null, url: address };
    }
    const file = fileId
      ? await this.dataSource.getRepository(FileObjectEntity).findOne({
          where: { id: fileId, organization_id: tenant.organizationId, owner_id: userId, purpose: FilePurposeEnum.RESOURCE, status: Not(FileStatusEnum.FAILED), deleted_at: IsNull() },
        })
      : null;
    if (!file) throw new BadRequestException({ message: 'Upload the file again', code: RESOURCE_ERRORS.FILE_INVALID });
    return { file_id: file.id, url: null };
  }

  private async checkSubject(tenant: Tenant, subjectId?: string | null): Promise<void> {
    if (!subjectId) return;
    const subject = await this.dataSource.getRepository(SubjectEntity).findOne({ where: { id: subjectId } });
    if (!subject || (subject.organization_id && subject.organization_id !== tenant.organizationId)) {
      throw new NotFoundException({ message: 'Subject not found', code: RESOURCE_ERRORS.SUBJECT_NOT_FOUND });
    }
  }

  private async checkFolder(tenant: Tenant, ownerId: string, folderId?: string | null): Promise<void> {
    if (folderId) await this.ownFolder(tenant, ownerId, folderId);
  }

  private async ownFolder(tenant: Tenant, userId: string, id: string): Promise<ResourceFolderEntity> {
    this.assertStaff(tenant);
    const folder = await this.folders.findOne({ where: { id, organization_id: tenant.organizationId, owner_id: userId, deleted_at: IsNull() } });
    if (!folder) throw new NotFoundException({ message: 'Folder not found', code: RESOURCE_ERRORS.FOLDER_NOT_FOUND });
    return folder;
  }

  private filters(qb: ReturnType<Repository<ResourceEntity>['createQueryBuilder']>, query: ListResourcesQueryDto): void {
    if (query.subject_id) qb.andWhere('r.subject_id = :subject', { subject: query.subject_id });
    if (query.type) qb.andWhere('r.type = :type', { type: query.type });
    const q = query.q?.trim();
    if (q) qb.andWhere('(r.title ILIKE :q OR r.description ILIKE :q)', { q: `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` });
  }

  private cleanTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
  }

  /** `onlyOfferings`: for students, the shares limited to their own subject classes. */
  private async toViews(tenant: Tenant, rows: ResourceEntity[], onlyOfferings?: string[]): Promise<ResourceView[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [shareRows, subjects, files, creators] = await Promise.all([
      this.shares.find({ where: { resource_id: In(ids) } }),
      this.dataSource.getRepository(SubjectEntity).find({ where: { id: In([...new Set(rows.map((r) => r.subject_id).filter((id): id is string => Boolean(id)))]) } }),
      this.dataSource.getRepository(FileObjectEntity).find({ where: { id: In(rows.map((r) => r.file_id).filter((id): id is string => Boolean(id))) } }),
      this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1)`, [[...new Set(rows.map((r) => r.created_by))]]) as Promise<{ id: string; full_name: string }[]>,
    ]);
    const visibleShares = onlyOfferings ? shareRows.filter((s) => onlyOfferings.includes(s.offering_id)) : shareRows;
    const labels = new Map(
      (await this.sections.offeringsWithTeachers(tenant.organizationId, [...new Set(visibleShares.map((s) => s.offering_id))])).map(({ offering }) => [offering.id, this.label(offering)]),
    );
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const fileById = new Map(files.map((f) => [f.id, f]));
    const creatorName = new Map(creators.map((c) => [c.id, c.full_name ?? '']));
    return rows.map((r) => {
      const file = r.file_id ? fileById.get(r.file_id) : undefined;
      return {
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        subject: r.subject_id ? { id: r.subject_id, name: subjectName.get(r.subject_id) ?? '' } : null,
        folder_id: r.folder_id,
        tags: r.tags ?? [],
        download_allowed: r.download_allowed,
        archived: Boolean(r.archived_at),
        url: r.type === ResourceTypeEnum.LINK ? (r.url ?? '') : `/files/${r.file_id}/content`,
        file: file ? { name: file.original_name ?? 'file', mime: file.mime, size: Number(file.size_bytes ?? 0) } : null,
        shares: visibleShares.filter((s) => s.resource_id === r.id).map((s) => ({ offering_id: s.offering_id, label: labels.get(s.offering_id) ?? '' })),
        created_by: { id: r.created_by, name: creatorName.get(r.created_by) ?? '' },
        created_at: r.created_at,
      };
    });
  }

  private label(offering: { section?: { name?: string; class?: { class_name?: string } | null } | null; subject?: { name?: string } | null }): string {
    return `${`${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim()} · ${offering.subject?.name ?? ''}`;
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Resource not found', code: RESOURCE_ERRORS.NOT_FOUND });
  }
}
