import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, LessThan, Repository } from 'typeorm';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { tenantScoped } from 'src/common/tenancy/tenant-repository';
import { DiscussionAccessService } from 'src/classes/discussion-access.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { FILES_PROCESS_JOB, FILES_QUEUE } from 'src/queue/queue.constants';
import { optimizeImageBuffer } from 'src/storage/image-optimize.util';
import { StorageService } from 'src/storage/storage.service';
import { SignedUpload } from 'src/storage/storage.types';
import { LimitKey } from 'src/subscriptions/constants/feature-catalog';
import { EntitlementsService, PlanLimitReachedException } from 'src/subscriptions/entitlements.service';
import { FileObjectEntity } from './entities/file-object.entity';
import {
  extensionForMime,
  FilePurposeEnum,
  FileStatusEnum,
  isImageMime,
  MAX_UPLOAD_BYTES,
  STORAGE_WARNING_RATIO,
  StorageUsageGroup,
  UPLOAD_RULES,
  usageGroupOf,
} from './file-rules';

/** How long the browser has to upload after asking for a link. */
const UPLOAD_LINK_SECONDS = 15 * 60;
/** Download links last 1 hour (design §8.5). */
export const DOWNLOAD_LINK_SECONDS = 60 * 60;
/** A link handed out but never completed for this long frees its quota. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;
/** A completed upload still PENDING after this long is queued again (the job was lost). */
const REQUEUE_AFTER_MS = 10 * 60 * 1000;

const MB = 1024 * 1024;
/** Who may delete any file of a workspace and see its storage use (FND-16). */
const MANAGER_ROLES = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

export interface UploadRequest {
  purpose: string;
  mime: string;
  size: number;
  name?: string;
  /** Class id for DISCUSSION files: the file belongs to the class's organisation. */
  scopeId?: string;
}

export interface FileView {
  id: string;
  purpose: FilePurposeEnum;
  status: FileStatusEnum;
  mime: string;
  name: string | null;
  size_bytes: number;
  original_size_bytes: number | null;
  width: number | null;
  height: number | null;
  /** Stable link to the file (redirects to a 1-hour signed link); safe to store in content. */
  url: string;
  created_at: Date;
}

export interface StorageUsage {
  used_bytes: number;
  /** 0 = no limit. */
  limit_bytes: number;
  /** 0–100, rounded down; 0 when there is no limit. */
  percent: number;
  /** At 90% or more (FND-16). */
  warning: boolean;
  /** At 100%: uploads are blocked. */
  full: boolean;
  by_type: Record<StorageUsageGroup, number>;
}

/**
 * Stored files (FND-15, FND-16, design §8.5). The browser asks for an upload link, PUTs the file
 * straight to storage under tmp/, then completes; the worker's files.process job compresses it and
 * moves it to org/{orgId}/{purpose}/{yyyy}/{uuid}.{ext}. Every file counts toward its
 * organisation's `max_storage_mb` while it is PENDING or READY and not deleted.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileObjectEntity)
    private readonly fileRepo: Repository<FileObjectEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectQueue(FILES_QUEUE)
    private readonly filesQueue: Queue,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
    private readonly discussionAccess: DiscussionAccessService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Step 1: check type, size and quota, reserve the space and hand out an upload link. */
  async createUpload(
    user: JwtPayloadInterface,
    request: UploadRequest,
  ): Promise<{ file: FileView; upload: SignedUpload; storage: StorageUsage }> {
    const file = await this.reserve(user, request);
    const upload = await this.storage.signUpload(file.s3_key, file.mime, UPLOAD_LINK_SECONDS);
    return { file: this.toView(file), upload, storage: await this.usage(file.organization_id) };
  }

  /**
   * The same flow for the older multipart endpoints (/uploads/media, /uploads/discussion): the API
   * receives the bytes, stores them under tmp/ and completes; compression still runs in the worker.
   */
  async uploadBuffer(
    user: JwtPayloadInterface,
    request: Omit<UploadRequest, 'size'>,
    body: Buffer,
  ): Promise<FileView> {
    const file = await this.reserve(user, { ...request, size: body.byteLength });
    await this.storage.put({ key: file.s3_key, body, contentType: file.mime });
    return this.complete(user, file.id);
  }

  /** Step 2: the browser finished its PUT. Checks the stored object and queues files.process. */
  async complete(user: JwtPayloadInterface, fileId: string): Promise<FileView> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, owner_id: user.id, deleted_at: IsNull() } });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (file.status !== FileStatusEnum.PENDING || file.original_size_bytes !== null) {
      return this.toView(file);
    }

    const stored = await this.storage.head(file.s3_key);
    if (!stored) {
      throw new BadRequestException('The file has not been uploaded yet');
    }
    if (stored.size > MAX_UPLOAD_BYTES || stored.size > file.size_bytes) {
      await this.fileRepo.update({ id: file.id }, { status: FileStatusEnum.FAILED });
      throw new PayloadTooLargeException('The uploaded file is larger than declared or over 20 MB');
    }

    file.size_bytes = stored.size;
    file.original_size_bytes = stored.size;
    await this.fileRepo.update({ id: file.id }, { size_bytes: stored.size, original_size_bytes: stored.size });
    await this.enqueue(file.id);

    this.audit.record({
      action: AUDIT_ACTIONS.FILE_UPLOAD,
      organizationId: file.organization_id,
      actorId: user.id,
      entityType: 'file_object',
      entityId: file.id,
      after: { purpose: file.purpose, mime: file.mime, size_bytes: stored.size, name: file.original_name },
    });
    return this.toView(file);
  }

  /** The uploader, or a member of the file's organisation, sees it; everyone else gets 404. */
  async getForUser(user: JwtPayloadInterface, fileId: string): Promise<FileView> {
    return this.toView(await this.findVisible(user, fileId));
  }

  /**
   * Where `GET /files/:id/content` redirects: a 1-hour signed link. Open by id (an unguessable
   * uuid), like the older /uploads/content proxy, so <img> tags work without the login header.
   * While the file is being processed the upload itself is served.
   */
  async contentLink(fileId: string): Promise<{ url: string; ready: boolean }> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, deleted_at: IsNull() } });
    if (!file || file.status === FileStatusEnum.FAILED || (file.status === FileStatusEnum.PENDING && file.original_size_bytes === null)) {
      throw new NotFoundException('File not found');
    }
    const url = await this.storage.signDownload(file.s3_key, DOWNLOAD_LINK_SECONDS, {
      contentType: file.mime,
      fileName: file.original_name ?? undefined,
    });
    return { url, ready: file.status === FileStatusEnum.READY };
  }

  /** Soft delete (no hard deletes): frees the quota; the stored object is kept for now. */
  async remove(user: JwtPayloadInterface, fileId: string): Promise<void> {
    const file = await this.findVisible(user, fileId);
    const tenant = TenantContext.current();
    const manages =
      tenant?.organizationId === file.organization_id && !tenant.viaEnrolment && MANAGER_ROLES.includes(tenant.memberRole);
    if (file.owner_id !== user.id && !manages) {
      throw new ForbiddenException('Only the uploader or the workspace owner and admins can delete this file');
    }

    await this.fileRepo.update({ id: file.id }, { deleted_at: new Date(), deleted_by: user.id });
    this.audit.record({
      action: AUDIT_ACTIONS.FILE_DELETE,
      organizationId: file.organization_id,
      actorId: user.id,
      entityType: 'file_object',
      entityId: file.id,
      before: { purpose: file.purpose, size_bytes: file.size_bytes, name: file.original_name },
    });
  }

  /** The current workspace's storage use, for its owner and admins (FND-16). */
  async usageForCurrentWorkspace(): Promise<StorageUsage> {
    const tenant = TenantContext.current();
    if (!tenant || tenant.viaEnrolment || !MANAGER_ROLES.includes(tenant.memberRole)) {
      throw new ForbiddenException('Only the owner and admins can see storage use');
    }
    return this.usage(tenant.organizationId);
  }

  async usage(organizationId: string, manager?: EntityManager): Promise<StorageUsage> {
    const repo = manager ? manager.getRepository(FileObjectEntity) : this.fileRepo;
    const rows = (await tenantScoped(repo)
      .forOrganization(organizationId)
      .createQueryBuilder('f')
      .select('f.purpose', 'purpose')
      .addSelect('COALESCE(SUM(f.size_bytes), 0)', 'bytes')
      .andWhere('f.deleted_at IS NULL')
      .andWhere('f.status IN (:...statuses)', { statuses: [FileStatusEnum.PENDING, FileStatusEnum.READY] })
      .groupBy('f.purpose')
      .getRawMany()) as Array<{ purpose: string; bytes: string }>;

    const byType: Record<StorageUsageGroup, number> = { homework: 0, resources: 0, video: 0, other: 0 };
    let used = 0;
    for (const row of rows) {
      const bytes = Number(row.bytes);
      byType[usageGroupOf(row.purpose)] += bytes;
      used += bytes;
    }

    const { limits } = await this.entitlements.getEntitlements(organizationId);
    const limitBytes = Math.max(0, Number(limits[LimitKey.MAX_STORAGE_MB] ?? 0)) * MB;
    const ratio = limitBytes > 0 ? used / limitBytes : 0;
    return {
      used_bytes: used,
      limit_bytes: limitBytes,
      percent: Math.min(100, Math.floor(ratio * 100)),
      warning: limitBytes > 0 && ratio >= STORAGE_WARNING_RATIO,
      full: limitBytes > 0 && used >= limitBytes,
      by_type: byType,
    };
  }

  /**
   * files.process (worker): compress images to WebP (FND-15), store other types as they are, and
   * move the file to its final key. Runs once per file: anything but an uploaded PENDING file is
   * skipped, and the final write only applies while the row is still PENDING.
   */
  async process(fileId: string): Promise<{ fileId: string; status: string; size_bytes?: number }> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file || file.status !== FileStatusEnum.PENDING || file.original_size_bytes === null || file.deleted_at) {
      return { fileId, status: 'skipped' };
    }

    const original = await this.storage.get(file.s3_key);
    const optimized = isImageMime(file.mime) ? await optimizeImageBuffer(original, file.mime) : null;
    const body = optimized?.buffer ?? original;
    const mime = optimized?.contentType ?? file.mime;
    const year = new Date(file.created_at).getUTCFullYear();
    const key = `org/${file.organization_id}/${file.purpose.toLowerCase()}/${year}/${file.id}.${optimized?.extension ?? extensionForMime(mime)}`;

    await this.storage.put({ key, body, contentType: mime });
    await this.fileRepo.update(
      { id: file.id, status: FileStatusEnum.PENDING },
      {
        s3_key: key,
        mime,
        size_bytes: body.byteLength,
        width: optimized?.width ?? null,
        height: optimized?.height ?? null,
        status: FileStatusEnum.READY,
      },
    );
    this.logger.log(`File ${file.id} ready: ${file.original_size_bytes} B -> ${body.byteLength} B`);
    return { fileId, status: FileStatusEnum.READY, size_bytes: body.byteLength };
  }

  /** files.process gave up after its retries: the file stops counting toward the quota. */
  async markFailed(fileId: string): Promise<void> {
    await this.fileRepo.update({ id: fileId, status: FileStatusEnum.PENDING }, { status: FileStatusEnum.FAILED });
  }

  /**
   * files.sweep (worker): links never completed within 24 h become FAILED (their space is freed),
   * and completed uploads still PENDING after 10 minutes are queued again.
   */
  async sweep(now = new Date()): Promise<{ abandoned: number; requeued: number }> {
    const abandoned = await this.fileRepo.update(
      {
        status: FileStatusEnum.PENDING,
        original_size_bytes: IsNull(),
        created_at: LessThan(new Date(now.getTime() - ABANDONED_AFTER_MS)),
      },
      { status: FileStatusEnum.FAILED },
    );

    const stuck = await this.fileRepo
      .createQueryBuilder('f')
      .select('f.id', 'id')
      .where('f.status = :status', { status: FileStatusEnum.PENDING })
      .andWhere('f.original_size_bytes IS NOT NULL')
      .andWhere('f.deleted_at IS NULL')
      .andWhere('f.updated_at < :before', { before: new Date(now.getTime() - REQUEUE_AFTER_MS) })
      .limit(500)
      .getRawMany<{ id: string }>();
    for (const { id } of stuck) {
      await this.enqueue(id);
    }
    return { abandoned: abandoned.affected ?? 0, requeued: stuck.length };
  }

  /** The stable link stored in content (exam images, discussion attachments). */
  contentUrl(fileId: string): string {
    const base = (this.config.get<string>('BACKEND_BASE_URL') || '').replace(/\/$/, '');
    return `${base}/api/v1/files/${fileId}/content`;
  }

  toView(file: FileObjectEntity): FileView {
    return {
      id: file.id,
      purpose: file.purpose,
      status: file.status,
      mime: file.mime,
      name: file.original_name,
      size_bytes: file.size_bytes,
      original_size_bytes: file.original_size_bytes,
      width: file.width,
      height: file.height,
      url: this.contentUrl(file.id),
      created_at: file.created_at,
    };
  }

  private async enqueue(fileId: string): Promise<void> {
    // One job per file: BullMQ ignores a second add while the first is still kept.
    await this.filesQueue.add(FILES_PROCESS_JOB, { fileId }, { jobId: `process-${fileId}` });
  }

  private async reserve(user: JwtPayloadInterface, request: UploadRequest): Promise<FileObjectEntity> {
    const purpose = String(request.purpose || '').trim().toUpperCase() as FilePurposeEnum;
    const allowed = UPLOAD_RULES[purpose];
    if (!allowed) {
      throw new BadRequestException(`Invalid purpose. Allowed: ${Object.keys(UPLOAD_RULES).join(', ')}`);
    }
    const mime = String(request.mime || '').trim().toLowerCase();
    if (!allowed.includes(mime)) {
      throw new BadRequestException(`Unsupported file type for ${purpose}. Allowed: ${allowed.join(', ')}`);
    }
    const size = Number(request.size);
    if (!Number.isInteger(size) || size < 1) {
      throw new BadRequestException('File size is required');
    }
    if (size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('Files can be at most 20 MB');
    }

    const organizationId = await this.organizationFor(user, purpose, request.scopeId);
    const name = cleanFileName(request.name);

    return this.dataSource.transaction(async (manager) => {
      // One reservation at a time per organisation, so parallel uploads cannot pass the quota together.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`files:${organizationId}`]);
      const usage = await this.usage(organizationId, manager);
      if (usage.limit_bytes > 0 && usage.used_bytes + size > usage.limit_bytes) {
        throw new PlanLimitReachedException(
          LimitKey.MAX_STORAGE_MB,
          `Your storage is full (${Math.round(usage.used_bytes / MB)} of ${Math.round(usage.limit_bytes / MB)} MB used). Delete files or upgrade your plan.`,
        );
      }
      const repo = manager.getRepository(FileObjectEntity);
      return repo.save(
        repo.create({
          organization_id: organizationId,
          owner_id: user.id,
          purpose,
          s3_key: `tmp/${randomUUID()}`,
          mime,
          original_name: name,
          size_bytes: size,
          original_size_bytes: null,
          status: FileStatusEnum.PENDING,
        }),
      );
    });
  }

  /**
   * The organisation the file belongs to: a discussion file to its class's organisation (students
   * outside a workspace session post there too), everything else to the current workspace.
   */
  private async organizationFor(user: JwtPayloadInterface, purpose: FilePurposeEnum, scopeId?: string): Promise<string> {
    if (purpose !== FilePurposeEnum.DISCUSSION) {
      return TenantContext.requireOrganizationId();
    }
    const classId = (scopeId || '').trim();
    if (!classId) {
      throw new BadRequestException('The class is required for discussion uploads');
    }
    const classEntity = await this.discussionAccess.getClassOrThrow(classId);
    this.discussionAccess.assertWorkspaceAllowsClass(classEntity, user);
    if (user.role === RolesEnum.STUDENT) {
      await this.discussionAccess.assertJoinedStudent(user.id, classEntity.id);
    }
    if (!classEntity.organization_id) {
      throw new BadRequestException('This class has no workspace');
    }
    return classEntity.organization_id;
  }

  private async findVisible(user: JwtPayloadInterface, fileId: string): Promise<FileObjectEntity> {
    // Students of a solo teacher reach that workspace through enrolment only: they see their own files.
    const tenant = TenantContext.current();
    const file = tenant && !tenant.viaEnrolment
      ? await tenantScoped(this.fileRepo).findOne({ where: { id: fileId, deleted_at: IsNull() } })
      : null;
    const own = file ?? (await this.fileRepo.findOne({ where: { id: fileId, owner_id: user.id, deleted_at: IsNull() } }));
    if (!own) {
      throw new NotFoundException('File not found');
    }
    return own;
  }
}

/** The name to show for a file: no path separators or control characters, at most 255 characters. */
export function cleanFileName(name: string | undefined): string | null {
  const cleaned = Array.from(name ?? '')
    .map((char) => (char === '/' || char === '\\' || char.charCodeAt(0) < 32 ? '_' : char))
    .join('')
    .trim()
    .slice(0, 255);
  return cleaned || null;
}
