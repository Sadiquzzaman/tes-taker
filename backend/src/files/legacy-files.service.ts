import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { basename, extname } from 'path';
import { DataSource, Repository } from 'typeorm';
import { DiscussionAttachment } from 'src/chat-mongo/schemas/discussion-attachment.schema';
import { DiscussionPost } from 'src/chat-mongo/schemas/discussion-post.schema';
import { PrivateConversation } from 'src/chat-mongo/schemas/private-conversation.schema';
import { PrivateMessage } from 'src/chat-mongo/schemas/private-message.schema';
import { StorageService } from 'src/storage/storage.service';
import { FileObjectEntity } from './entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from './file-rules';
import { FilesService } from './files.service';

/** Prefixes the old upload endpoints wrote to (and /uploads/content serves). */
const LEGACY_PREFIXES: Record<string, FilePurposeEnum> = {
  'discussions/': FilePurposeEnum.DISCUSSION,
  'exams/': FilePurposeEnum.EXAM,
  'images/': FilePurposeEnum.IMAGE,
};

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
};

const isLegacyKey = (key: string): boolean =>
  !key.includes('..') && Object.keys(LEGACY_PREFIXES).some((prefix) => key.startsWith(prefix));

/**
 * The storage key behind a link the old upload endpoints returned, or null for anything else:
 * `/uploads/{key}` (local), `https://{bucket}.s3.{region}.amazonaws.com/{key}` (S3) and
 * `…/api/v1/uploads/content?key={key}` (the S3 proxy), relative or absolute.
 */
export function parseLegacyKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  let key: string | null = null;
  try {
    const url = new URL(raw, 'http://legacy.invalid');
    if (url.pathname.endsWith('/uploads/content')) {
      key = url.searchParams.get('key');
    } else if (/\.s3[.-][a-z0-9.-]*amazonaws\.com$/i.test(url.hostname)) {
      key = decodeURIComponent(url.pathname.replace(/^\//, ''));
    } else if (url.pathname.startsWith('/uploads/')) {
      key = decodeURIComponent(url.pathname.slice('/uploads/'.length));
    }
  } catch {
    return null;
  }
  return key && isLegacyKey(key) ? key : null;
}

export interface LegacyMoveCounts {
  /** Links to old files found in content. */
  found: number;
  /** Files copied to org/{orgId}/legacy/ and recorded in file_objects. */
  copied: number;
  /** Files moved by an earlier run (file_objects.legacy_key). */
  reused: number;
  /** Links whose file is not in storage; left unchanged. */
  missing: number;
  /** Links whose organisation could not be worked out; left unchanged. */
  no_organization: number;
  /** Rows or documents whose links were rewritten. */
  rewritten: number;
}

type Source = 'exam_questions' | 'discussion_posts' | 'private_messages';

/**
 * M4 (design §12): copy files from the old /uploads storage to org/{orgId}/legacy/{old key},
 * record them in file_objects and rewrite the links in exam questions and discussion
 * attachments to /files/{id}/content. Dry run unless `apply`; re-runnable (an old key is copied
 * once, `legacy_key` is unique) and logged per source. Old files are never deleted, and the
 * old /uploads routes stay read-only.
 *
 * A one-off data move like a migration, so it updates exam and chat content directly.
 */
@Injectable()
export class LegacyFilesService {
  private readonly logger = new Logger(LegacyFilesService.name);

  constructor(
    @InjectRepository(FileObjectEntity)
    private readonly fileRepo: Repository<FileObjectEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectModel(DiscussionPost.name)
    private readonly postModel: Model<DiscussionPost>,
    @InjectModel(PrivateMessage.name)
    private readonly messageModel: Model<PrivateMessage>,
    @InjectModel(PrivateConversation.name)
    private readonly conversationModel: Model<PrivateConversation>,
    private readonly storage: StorageService,
    private readonly files: FilesService,
  ) {}

  async run({ apply }: { apply: boolean }): Promise<Record<Source, LegacyMoveCounts>> {
    this.logger.log(`Moving legacy files (${apply ? 'APPLY' : 'dry run'}, storage: ${this.storage.driverName})`);
    const result = {
      exam_questions: await this.moveExamQuestions(apply),
      discussion_posts: await this.moveDiscussionPosts(apply),
      private_messages: await this.movePrivateMessages(apply),
    };
    for (const [source, counts] of Object.entries(result)) {
      this.logger.log(`${source}: ${JSON.stringify(counts)}`);
    }
    return result;
  }

  private async moveExamQuestions(apply: boolean): Promise<LegacyMoveCounts> {
    const counts = emptyCounts();
    const rows = (await this.dataSource.query(`
      SELECT q.id, q.image_url, q.options_json, q.matching_options_json, e.organization_id
      FROM exam_questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE q.image_url LIKE '%uploads%' OR q.image_url LIKE '%amazonaws.com%'
         OR q.options_json::text LIKE '%"image"%' OR q.matching_options_json::text LIKE '%"image"%'
    `)) as Array<{
      id: string;
      image_url: string | null;
      options_json: Array<{ image?: string | null }> | null;
      matching_options_json: { left?: Array<{ image?: string | null }>; right?: Array<{ image?: string | null }> } | null;
      organization_id: string | null;
    }>;

    for (const row of rows) {
      const relink = (url: string | null | undefined) => this.relink(url, row.organization_id, apply, counts);
      const imageUrl = await relink(row.image_url);
      const options = row.options_json ? await Promise.all(row.options_json.map(async (o) => this.withImage(o, await relink(o.image)))) : null;
      const matching = row.matching_options_json
        ? {
            ...row.matching_options_json,
            left: await this.relinkOptions(row.matching_options_json.left, relink),
            right: await this.relinkOptions(row.matching_options_json.right, relink),
          }
        : null;

      const changed =
        imageUrl !== row.image_url ||
        JSON.stringify(options) !== JSON.stringify(row.options_json) ||
        JSON.stringify(matching) !== JSON.stringify(row.matching_options_json);
      if (changed && apply) {
        await this.dataSource.query(
          `UPDATE exam_questions SET image_url = $2, options_json = $3, matching_options_json = $4 WHERE id = $1`,
          [row.id, imageUrl, options ? JSON.stringify(options) : null, matching ? JSON.stringify(matching) : null],
        );
        counts.rewritten += 1;
      }
    }
    return counts;
  }

  private async moveDiscussionPosts(apply: boolean): Promise<LegacyMoveCounts> {
    const counts = emptyCounts();
    const posts = await this.postModel.find(this.legacyAttachmentFilter()).lean();
    for (const post of posts) {
      const organizationId = post.organizationId ?? (await this.classOrganization(post.classId));
      const attachments = await this.relinkAttachments(post.attachments, organizationId, apply, counts);
      if (attachments && apply) {
        await this.postModel.updateOne({ _id: post._id }, { $set: { attachments } });
        counts.rewritten += 1;
      }
    }
    return counts;
  }

  private async movePrivateMessages(apply: boolean): Promise<LegacyMoveCounts> {
    const counts = emptyCounts();
    const messages = await this.messageModel.find(this.legacyAttachmentFilter()).lean();
    const organizations = new Map<string, string | null>();
    for (const message of messages) {
      if (!organizations.has(message.conversationId)) {
        const conversation = await this.conversationModel.findById(message.conversationId).lean();
        organizations.set(
          message.conversationId,
          conversation ? (conversation.organizationId ?? (await this.classOrganization(conversation.classId))) : null,
        );
      }
      const attachments = await this.relinkAttachments(message.attachments, organizations.get(message.conversationId) ?? null, apply, counts);
      if (attachments && apply) {
        await this.messageModel.updateOne({ _id: message._id }, { $set: { attachments } });
        counts.rewritten += 1;
      }
    }
    return counts;
  }

  private legacyAttachmentFilter() {
    return { 'attachments.key': { $in: Object.keys(LEGACY_PREFIXES).map((prefix) => new RegExp(`^${prefix}`)) } };
  }

  /** The attachments with old keys pointed at their files, or null when none changed. */
  private async relinkAttachments(
    attachments: DiscussionAttachment[] | undefined,
    organizationId: string | null,
    apply: boolean,
    counts: LegacyMoveCounts,
  ): Promise<DiscussionAttachment[] | null> {
    let changed = false;
    const next: DiscussionAttachment[] = [];
    for (const attachment of attachments ?? []) {
      const key = isLegacyKey(attachment.key) ? attachment.key : parseLegacyKey(attachment.url);
      const fileId = key ? await this.ensureFile(key, organizationId, apply, counts) : null;
      if (fileId) {
        next.push({ ...attachment, key: fileId, url: this.files.contentUrl(fileId) });
        changed = true;
      } else {
        next.push(attachment);
      }
    }
    return changed ? next : null;
  }

  private async relinkOptions<T extends { image?: string | null }>(
    options: T[] | undefined,
    relink: (url: string | null | undefined) => Promise<string | null | undefined>,
  ): Promise<T[] | undefined> {
    return options ? Promise.all(options.map(async (option) => this.withImage(option, await relink(option.image)))) : options;
  }

  private withImage<T extends { image?: string | null }>(option: T, image: string | null | undefined): T {
    return image === option.image ? option : { ...option, image };
  }

  /** The new link for an old one, or the link unchanged (not legacy, missing, or a dry run). */
  private async relink(
    url: string | null | undefined,
    organizationId: string | null,
    apply: boolean,
    counts: LegacyMoveCounts,
  ): Promise<string | null | undefined> {
    const key = parseLegacyKey(url);
    if (!key) return url;
    const fileId = await this.ensureFile(key, organizationId, apply, counts);
    return fileId ? this.files.contentUrl(fileId) : url;
  }

  /** The file_objects id for an old key, copying it the first time. Null: leave the link (or dry run). */
  private async ensureFile(
    legacyKey: string,
    organizationId: string | null,
    apply: boolean,
    counts: LegacyMoveCounts,
  ): Promise<string | null> {
    counts.found += 1;
    const existing = await this.fileRepo.findOne({ where: { legacy_key: legacyKey } });
    if (existing) {
      counts.reused += 1;
      return existing.id;
    }
    if (!organizationId) {
      counts.no_organization += 1;
      return null;
    }
    const stored = await this.storage.head(legacyKey);
    if (!stored) {
      counts.missing += 1;
      this.logger.warn(`Legacy file missing in storage: ${legacyKey}`);
      return null;
    }
    counts.copied += 1;
    if (!apply) return null;

    const newKey = `org/${organizationId}/legacy/${legacyKey}`;
    await this.storage.copy(legacyKey, newKey);
    const purpose = Object.entries(LEGACY_PREFIXES).find(([prefix]) => legacyKey.startsWith(prefix))?.[1] ?? FilePurposeEnum.IMAGE;
    const inserted = (await this.fileRepo
      .createQueryBuilder()
      .insert()
      .values({
        organization_id: organizationId,
        owner_id: null,
        purpose,
        s3_key: newKey,
        mime: stored.contentType || MIME_BY_EXT[extname(legacyKey).toLowerCase()] || 'application/octet-stream',
        original_name: basename(legacyKey).replace(/^[0-9a-f-]{36}-/i, '').slice(0, 255),
        size_bytes: stored.size,
        original_size_bytes: stored.size,
        status: FileStatusEnum.READY,
        legacy_key: legacyKey,
      })
      .orIgnore()
      .returning(['id'])
      .execute()) as { raw: Array<{ id: string }> };
    const id = inserted.raw[0]?.id ?? (await this.fileRepo.findOneOrFail({ where: { legacy_key: legacyKey } })).id;
    return id;
  }

  private async classOrganization(classId: string | null | undefined): Promise<string | null> {
    if (!classId) return null;
    const rows = (await this.dataSource.query(`SELECT organization_id FROM classes WHERE id::text = $1`, [classId])) as Array<{
      organization_id: string | null;
    }>;
    return rows[0]?.organization_id ?? null;
  }
}

function emptyCounts(): LegacyMoveCounts {
  return { found: 0, copied: 0, reused: 0, missing: 0, no_organization: 0, rewritten: 0 };
}
