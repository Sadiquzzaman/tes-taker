import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { ChatUserMute } from 'src/chat-mongo/schemas/chat-user-mute.schema';
import { GroupMessage } from 'src/chat-mongo/schemas/group-message.schema';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { CHAT_ERRORS } from './chat-errors';

export type Timestamped<T> = T & { createdAt: Date; updatedAt: Date };

const PREVIEW_LENGTH = 120;

export interface ChatMessageView {
  id: string;
  group_id: string;
  parent_id: string | null;
  author: { id: string; name: string; is_teacher: boolean };
  content: string;
  attachments: { file_id: string; name: string; mime: string; size: number; url: string }[];
  reply_to: { id: string; author_name: string; content: string; deleted: boolean } | null;
  comment_count: number;
  last_comment_at: Date | null;
  pinned: boolean;
  deleted: boolean;
  created_at: Date;
}

/**
 * What group and private chats share (Epic 7): checking a message's files, people's names, short
 * previews and the message view sent to the web. Messages of both kinds live in
 * `group_messages`, keyed by the chat's id.
 */
@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectModel(GroupMessage.name) private readonly messages: Model<GroupMessage>,
    @InjectModel(ChatUserMute.name) private readonly mutes: Model<ChatUserMute>,
    private readonly dataSource: DataSource,
  ) {}

  /** A closed chat takes nothing new (409); a person muted in it can't write until the mute ends (403). */
  async assertCanWrite(chat: { _id: string; closedAt?: Date | null }, userId: string): Promise<void> {
    if (chat.closedAt) {
      throw new ConflictException({ message: 'This chat was closed by the school', code: CHAT_ERRORS.CLOSED });
    }
    const mute = await this.mutes.findOne({ chatId: chat._id, userId, until: { $gt: new Date() } }).lean<ChatUserMute>();
    if (mute) {
      throw new ForbiddenException({ message: 'You were muted in this chat', code: CHAT_ERRORS.MUTED, until: mute.until });
    }
  }

  /** The sender's own chat uploads in this organisation. */
  async attachments(organizationId: string, userId: string, fileIds: string[]) {
    if (fileIds.length === 0) return [];
    const files = await this.dataSource.getRepository(FileObjectEntity).find({
      where: { id: In(fileIds), organization_id: organizationId, owner_id: userId, purpose: FilePurposeEnum.DISCUSSION, status: Not(FileStatusEnum.FAILED), deleted_at: IsNull() },
    });
    if (files.length !== fileIds.length) {
      throw new BadRequestException({ message: 'Upload the files again', code: CHAT_ERRORS.FILE_INVALID });
    }
    const byId = new Map(files.map((f) => [f.id, f]));
    return fileIds.map((id) => {
      const file = byId.get(id)!;
      return { fileId: file.id, name: file.original_name ?? 'file', mime: file.mime, size: Number(file.size_bytes ?? 0) };
    });
  }

  async views(rows: Timestamped<GroupMessage>[], context: { teacherIds: string[]; pinnedIds?: string[] }): Promise<ChatMessageView[]> {
    const replyIds = [...new Set(rows.map((r) => r.replyToId).filter((id): id is string => Boolean(id)))];
    const replies = replyIds.length ? await this.messages.find({ _id: { $in: replyIds } }).lean<Timestamped<GroupMessage>[]>() : [];
    const names = await this.userNames([...rows.map((r) => r.authorId), ...replies.map((r) => r.authorId)]);
    const replyById = new Map(replies.map((r) => [r._id, r]));
    return rows.map((row) => {
      const deleted = Boolean(row.deletedAt);
      const reply = row.replyToId ? replyById.get(row.replyToId) : undefined;
      return {
        id: row._id,
        group_id: row.groupId,
        parent_id: row.parentId,
        author: { id: row.authorId, name: names.get(row.authorId) ?? '', is_teacher: context.teacherIds.includes(row.authorId) },
        content: deleted ? '' : row.content,
        attachments: deleted ? [] : row.attachments.map((a) => ({ file_id: a.fileId, name: a.name, mime: a.mime, size: a.size, url: `/files/${a.fileId}/content` })),
        reply_to: reply
          ? { id: reply._id, author_name: names.get(reply.authorId) ?? '', content: reply.deletedAt ? '' : this.preview(reply), deleted: Boolean(reply.deletedAt) }
          : null,
        comment_count: row.commentCount,
        last_comment_at: row.lastCommentAt,
        pinned: (context.pinnedIds ?? []).includes(row._id),
        deleted,
        created_at: row.createdAt,
      };
    });
  }

  preview(message: { content: string; attachments: { name: string }[] }): string {
    const text = message.content.replace(/\s+/g, ' ').trim();
    if (text) return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
    return message.attachments.map((a) => a.name).join(', ');
  }

  async userNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1)`, [unique]);
    return new Map(rows.map((r) => [r.id, r.full_name ?? '']));
  }
}
