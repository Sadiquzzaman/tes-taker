import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { AcademicSessionStatusEnum } from 'src/academics/entities/academic-session.entity';
import { OfferingRosterService } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ChatMemberState } from 'src/chat-mongo/schemas/chat-member-state.schema';
import { GroupChat } from 'src/chat-mongo/schemas/group-chat.schema';
import { GroupMessage } from 'src/chat-mongo/schemas/group-message.schema';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { FilePurposeEnum, FileStatusEnum } from 'src/files/file-rules';
import { NOTIFICATION_EVENTS } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { ChatBroadcaster } from './chat-broadcaster';
import { CHAT_ERRORS } from './chat-errors';
import { ListChatMessagesQueryDto, MAX_MESSAGE_LENGTH, SendChatMessageDto } from './dto/chat.dto';

export type ChatRole = 'TEACHER' | 'STUDENT';
const MAX_PINS = 3;
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

export interface GroupChatView {
  id: string;
  offering_id: string;
  section_label: string;
  subject: { id: string; name: string };
  role: ChatRole;
  announcement_only: boolean;
  read_only: boolean;
  muted: boolean;
  unread: number;
  teachers: { id: string; name: string }[];
  last_message: { author_name: string; preview: string; created_at: Date } | null;
}

type Access = { group: GroupChat; role: ChatRole; label: string; teacherIds: string[]; readOnly: boolean };
type Timestamped<T> = T & { createdAt: Date; updatedAt: Date };

/**
 * Group chats (Epic 7, COM-01, COM-03): one per subject class, for its students and teachers
 * (the same rules as homework: `offering_teachers` and the offering roster). Posts with comment
 * threads, replies, files, pins, announcement mode, unread counts and mute. Messages go to the
 * group's sockets as they are sent. Owners and admins are not members (they get audited access
 * to chats in P9-02).
 */
@Injectable()
export class ChatGroupsService {
  constructor(
    @InjectModel(GroupChat.name) private readonly groups: Model<GroupChat>,
    @InjectModel(GroupMessage.name) private readonly messages: Model<GroupMessage>,
    @InjectModel(ChatMemberState.name) private readonly states: Model<ChatMemberState>,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  // ------------------------------------------------------------------ the list

  /** The caller's group chats in open sessions, with unread counts; most recent activity first. */
  async myGroups(tenant: Tenant, userId: string): Promise<GroupChatView[]> {
    const offeringIds = await this.offeringIdsOf(tenant, userId);
    const offerings = await this.sections.offeringsWithTeachers(tenant.organizationId, offeringIds);
    if (offerings.length === 0) return [];
    const groups = await this.ensureGroups(tenant.organizationId, offerings.map(({ offering }) => ({ id: offering.id, sessionId: offering.session_id })));
    const groupIds = [...groups.values()].map((g) => g._id);
    const states = new Map((await this.states.find({ chatId: { $in: groupIds }, userId }).lean()).map((s) => [s.chatId, s]));
    const teacherIds = [...new Set(offerings.flatMap((o) => o.teacherIds))];
    const lasts = await Promise.all(groupIds.map((id) => this.messages.findOne({ groupId: id, deletedAt: null }).sort({ createdAt: -1 }).lean<Timestamped<GroupMessage>>()));
    const names = await this.userNames([...teacherIds, ...lasts.filter(Boolean).map((m) => m!.authorId)]);
    const views = await Promise.all(
      offerings.map(async ({ offering, teacherIds: teachers }) => {
        const group = groups.get(offering.id)!;
        const state = states.get(group._id);
        const last = lasts[groupIds.indexOf(group._id)];
        const unread = await this.messages.countDocuments({
          groupId: group._id,
          deletedAt: null,
          authorId: { $ne: userId },
          ...(state?.lastReadAt ? { createdAt: { $gt: state.lastReadAt } } : {}),
        });
        return {
          id: group._id,
          offering_id: offering.id,
          section_label: this.sectionLabel(offering),
          subject: { id: offering.subject_id, name: offering.subject?.name ?? '' },
          role: teachers.includes(userId) ? 'TEACHER' : 'STUDENT',
          announcement_only: group.announcementOnly,
          read_only: false,
          muted: state?.muted ?? false,
          unread,
          teachers: teachers.map((id) => ({ id, name: names.get(id) ?? '' })),
          last_message: last ? { author_name: names.get(last.authorId) ?? '', preview: this.preview(last), created_at: last.createdAt } : null,
        } satisfies GroupChatView;
      }),
    );
    const activity = (v: GroupChatView) => v.last_message?.created_at.getTime() ?? 0;
    return views.sort((a, b) => activity(b) - activity(a) || a.section_label.localeCompare(b.section_label, 'en', { numeric: true }) || a.subject.name.localeCompare(b.subject.name));
  }

  /** The group ids a person's sockets join (the gateway, on connect). */
  async groupIdsOf(member: Pick<Tenant, 'organizationId' | 'memberRole'>, userId: string): Promise<string[]> {
    const offeringIds = await this.offeringIdsOf(member, userId);
    if (offeringIds.length === 0) return [];
    return (await this.groups.find({ offeringId: { $in: offeringIds } }, { _id: 1 }).lean()).map((g) => g._id);
  }

  async getGroup(tenant: Tenant, userId: string, groupId: string) {
    const access = await this.access(tenant, userId, groupId);
    const [state, pinned] = await Promise.all([
      this.states.findOne({ chatId: groupId, userId }).lean(),
      this.messages.find({ _id: { $in: access.group.pinnedIds }, deletedAt: null }).lean<Timestamped<GroupMessage>[]>(),
    ]);
    const names = await this.userNames(access.teacherIds);
    const pinnedViews = await this.toViews(access, pinned);
    return {
      id: groupId,
      label: access.label,
      role: access.role,
      announcement_only: access.group.announcementOnly,
      read_only: access.readOnly,
      muted: state?.muted ?? false,
      teachers: access.teacherIds.map((id) => ({ id, name: names.get(id) ?? '' })),
      pinned: access.group.pinnedIds.map((id) => pinnedViews.find((p) => p.id === id)).filter(Boolean),
    };
  }

  // ------------------------------------------------------------------ messages

  /** Posts, newest first (30 at a time; `before` for older). */
  async posts(tenant: Tenant, userId: string, groupId: string, query: ListChatMessagesQueryDto): Promise<ChatMessageView[]> {
    const access = await this.access(tenant, userId, groupId);
    const rows = await this.messages
      .find({ groupId, parentId: null, ...(query.before ? { createdAt: { $lt: new Date(query.before) } } : {}) })
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 30)
      .lean<Timestamped<GroupMessage>[]>();
    return this.toViews(access, rows);
  }

  /** A post's comments, oldest first. */
  async comments(tenant: Tenant, userId: string, groupId: string, postId: string): Promise<ChatMessageView[]> {
    const access = await this.access(tenant, userId, groupId);
    await this.findPost(groupId, postId);
    const rows = await this.messages.find({ groupId, parentId: postId }).sort({ createdAt: 1 }).limit(500).lean<Timestamped<GroupMessage>[]>();
    return this.toViews(access, rows);
  }

  async send(tenant: Tenant, userId: string, groupId: string, dto: SendChatMessageDto): Promise<ChatMessageView> {
    const access = await this.access(tenant, userId, groupId);
    this.assertWritable(access);
    const content = (dto.content ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
    const fileIds = [...new Set(dto.file_ids ?? [])];
    if (!content && fileIds.length === 0) {
      throw new BadRequestException({ message: 'Write a message or add a file', code: CHAT_ERRORS.EMPTY });
    }
    const parent = dto.parent_id ? await this.findPost(groupId, dto.parent_id) : null;
    if (!parent && access.group.announcementOnly && access.role !== 'TEACHER') {
      throw new ForbiddenException({ message: 'Only teachers can post here; you can comment on posts', code: CHAT_ERRORS.TEACHERS_ONLY });
    }
    if (dto.reply_to_id && !(await this.messages.exists({ _id: dto.reply_to_id, groupId }))) {
      throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    }
    const attachments = await this.attachments(tenant.organizationId, userId, fileIds);
    const created = await this.messages.create({
      groupId,
      organizationId: tenant.organizationId,
      parentId: parent?._id ?? null,
      replyToId: dto.reply_to_id ?? null,
      authorId: userId,
      content,
      attachments,
    });
    if (parent) {
      await this.messages.updateOne({ _id: parent._id }, { $inc: { commentCount: 1 }, $set: { lastCommentAt: created.createdAt } });
    }
    await this.states.updateOne({ chatId: groupId, userId }, { $set: { lastReadAt: created.createdAt } }, { upsert: true });
    const [view] = await this.toViews(access, [created.toObject() as Timestamped<GroupMessage>]);
    this.broadcaster.toGroup(groupId, 'chat:message', view);
    if (!parent && access.group.announcementOnly && access.role === 'TEACHER') {
      await this.announce(tenant, access, view);
    }
    return view;
  }

  /** The author deletes their own message; a teacher of the group any message (audited). */
  async remove(tenant: Tenant, userId: string, groupId: string, messageId: string): Promise<void> {
    const access = await this.access(tenant, userId, groupId);
    const message = await this.messages.findOne({ _id: messageId, groupId, deletedAt: null }).lean<Timestamped<GroupMessage>>();
    if (!message) throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    const own = message.authorId === userId;
    if (!own && access.role !== 'TEACHER') {
      throw new ForbiddenException({ message: "Only the group's teachers can delete others' messages", code: CHAT_ERRORS.NOT_TEACHER });
    }
    this.assertWritable(access);
    await this.messages.updateOne({ _id: messageId }, { $set: { deletedAt: new Date(), deletedBy: userId, content: '', attachments: [] } });
    if (message.parentId) await this.messages.updateOne({ _id: message.parentId }, { $inc: { commentCount: -1 } });
    if (access.group.pinnedIds.includes(messageId)) await this.groups.updateOne({ _id: groupId }, { $pull: { pinnedIds: messageId } });
    this.broadcaster.toGroup(groupId, 'chat:deleted', { group_id: groupId, id: messageId, parent_id: message.parentId });
    if (!own) {
      this.audit.record({
        action: AUDIT_ACTIONS.CHAT_MESSAGE_DELETE,
        organizationId: tenant.organizationId,
        actorId: userId,
        entityType: 'group_chat',
        entityId: groupId,
        before: { message_id: messageId, author_id: message.authorId, content: message.content, files: message.attachments.length },
      });
    }
  }

  /** A teacher pins a post (at most 3; the oldest pin drops off) or unpins it. */
  async pin(tenant: Tenant, userId: string, groupId: string, messageId: string, pinned: boolean) {
    const access = await this.access(tenant, userId, groupId);
    this.assertTeacher(access);
    const post = await this.findPost(groupId, messageId);
    const others = access.group.pinnedIds.filter((id) => id !== post._id);
    const pinnedIds = pinned ? [post._id, ...others].slice(0, MAX_PINS) : others;
    await this.groups.updateOne({ _id: groupId }, { $set: { pinnedIds } });
    this.broadcaster.toGroup(groupId, 'chat:group', { group_id: groupId, pinned_ids: pinnedIds, announcement_only: access.group.announcementOnly });
    return { pinned_ids: pinnedIds };
  }

  /** A teacher turns "Only teachers can post" on or off (audited). */
  async update(tenant: Tenant, userId: string, groupId: string, announcementOnly: boolean) {
    const access = await this.access(tenant, userId, groupId);
    this.assertTeacher(access);
    this.assertWritable(access);
    if (access.group.announcementOnly !== announcementOnly) {
      await this.groups.updateOne({ _id: groupId }, { $set: { announcementOnly } });
      this.audit.record({
        action: AUDIT_ACTIONS.CHAT_GROUP_UPDATE,
        organizationId: tenant.organizationId,
        actorId: userId,
        entityType: 'group_chat',
        entityId: groupId,
        before: { announcement_only: access.group.announcementOnly },
        after: { announcement_only: announcementOnly },
      });
    }
    this.broadcaster.toGroup(groupId, 'chat:group', { group_id: groupId, pinned_ids: access.group.pinnedIds, announcement_only: announcementOnly });
    return { announcement_only: announcementOnly };
  }

  async markRead(tenant: Tenant, userId: string, groupId: string): Promise<void> {
    await this.access(tenant, userId, groupId);
    await this.states.updateOne({ chatId: groupId, userId }, { $set: { lastReadAt: new Date() } }, { upsert: true });
  }

  /** Mute: no announcement notices from this group (COM-03); unread counts stay. */
  async mute(tenant: Tenant, userId: string, groupId: string, muted: boolean) {
    await this.access(tenant, userId, groupId);
    await this.states.updateOne({ chatId: groupId, userId }, { $set: { muted } }, { upsert: true });
    return { muted };
  }

  // ------------------------------------------------------------------ helpers

  private async offeringIdsOf(tenant: Pick<Tenant, 'organizationId' | 'memberRole'>, userId: string): Promise<string[]> {
    return tenant.memberRole === OrganizationMemberRoleEnum.STUDENT
      ? this.roster.offeringIdsOfStudent(tenant.organizationId, userId)
      : this.sections.offeringIdsTaughtBy(tenant.organizationId, userId);
  }

  /** One group per subject class, made on first sight. */
  private async ensureGroups(organizationId: string, offerings: { id: string; sessionId: string }[]): Promise<Map<string, GroupChat>> {
    if (offerings.length) {
      await this.groups.bulkWrite(
        offerings.map(({ id, sessionId }) => ({
          updateOne: { filter: { offeringId: id }, update: { $setOnInsert: { offeringId: id, organizationId, sessionId } }, upsert: true },
        })),
        { ordered: false },
      );
    }
    const rows = await this.groups.find({ offeringId: { $in: offerings.map((o) => o.id) } }).lean<GroupChat[]>();
    return new Map(rows.map((g) => [g.offeringId, g]));
  }

  /** A member of the group (a teacher of the subject class, or a student taking it), else 404. */
  private async access(tenant: Tenant, userId: string, groupId: string): Promise<Access> {
    const group = await this.groups.findOne({ _id: groupId, organizationId: tenant.organizationId }).lean<GroupChat>();
    if (!group) this.notFound();
    const [entry] = await this.sections.offeringsWithTeachers(tenant.organizationId, [group.offeringId]);
    if (!entry) this.notFound();
    const isTeacher = entry.teacherIds.includes(userId);
    const isStudent =
      !isTeacher && tenant.memberRole === OrganizationMemberRoleEnum.STUDENT && (await this.roster.offeringIdsOfStudent(tenant.organizationId, userId)).includes(group.offeringId);
    if (!isTeacher && !isStudent) this.notFound();
    return {
      group,
      role: isTeacher ? 'TEACHER' : 'STUDENT',
      label: `${this.sectionLabel(entry.offering)} · ${entry.offering.subject?.name ?? ''}`,
      teacherIds: entry.teacherIds,
      readOnly: entry.offering.session?.status !== AcademicSessionStatusEnum.ACTIVE,
    };
  }

  private assertWritable(access: Access): void {
    if (access.readOnly) {
      throw new ConflictException({ message: "This class's session is closed; its chat is read-only", code: CHAT_ERRORS.READ_ONLY });
    }
  }

  private assertTeacher(access: Access): void {
    if (access.role !== 'TEACHER') {
      throw new ForbiddenException({ message: "Only the group's teachers can do this", code: CHAT_ERRORS.NOT_TEACHER });
    }
  }

  private async findPost(groupId: string, postId: string): Promise<Timestamped<GroupMessage>> {
    const post = await this.messages.findOne({ _id: postId, groupId, deletedAt: null }).lean<Timestamped<GroupMessage>>();
    if (!post) throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    if (post.parentId) throw new BadRequestException({ message: 'Only posts can be pinned or commented on', code: CHAT_ERRORS.NOT_A_POST });
    return post;
  }

  /** The sender's own chat uploads in this organisation. */
  private async attachments(organizationId: string, userId: string, fileIds: string[]) {
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

  /** Members who did not mute the group get an in-app notice of a teacher's announcement. */
  private async announce(tenant: Tenant, access: Access, view: ChatMessageView): Promise<void> {
    const [entry] = await this.sections.offeringsWithTeachers(tenant.organizationId, [access.group.offeringId]);
    const students = entry ? (await this.roster.students(entry.offering)).map((s) => s.student_id) : [];
    const members = [...new Set([...students, ...access.teacherIds])].filter((id) => id !== view.author.id);
    const muted = new Set((await this.states.find({ chatId: access.group._id, userId: { $in: members }, muted: true }, { userId: 1 }).lean()).map((s) => s.userId));
    await this.notifications.notifyUsers({
      eventType: NOTIFICATION_EVENTS.CHAT_ANNOUNCEMENT,
      organizationId: tenant.organizationId,
      userIds: members.filter((id) => !muted.has(id)),
      variables: { group: access.label, author: view.author.name, preview: this.preview({ content: view.content, attachments: view.attachments }), path: `/chat?group=${access.group._id}` },
      dedupeKey: `${NOTIFICATION_EVENTS.CHAT_ANNOUNCEMENT}:${view.id}`,
    });
  }

  private async toViews(access: Access, rows: Timestamped<GroupMessage>[]): Promise<ChatMessageView[]> {
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
        author: { id: row.authorId, name: names.get(row.authorId) ?? '', is_teacher: access.teacherIds.includes(row.authorId) },
        content: deleted ? '' : row.content,
        attachments: deleted ? [] : row.attachments.map((a) => ({ file_id: a.fileId, name: a.name, mime: a.mime, size: a.size, url: `/files/${a.fileId}/content` })),
        reply_to: reply
          ? { id: reply._id, author_name: names.get(reply.authorId) ?? '', content: reply.deletedAt ? '' : this.preview(reply), deleted: Boolean(reply.deletedAt) }
          : null,
        comment_count: row.commentCount,
        last_comment_at: row.lastCommentAt,
        pinned: access.group.pinnedIds.includes(row._id),
        deleted,
        created_at: row.createdAt,
      };
    });
  }

  private preview(message: { content: string; attachments: { name: string }[] }): string {
    const text = message.content.replace(/\s+/g, ' ').trim();
    if (text) return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
    return message.attachments.map((a) => a.name).join(', ');
  }

  private sectionLabel(offering: { section?: { name?: string; class?: { class_name?: string } | null } | null }): string {
    return `${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim();
  }

  private async userNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows: { id: string; full_name: string }[] = await this.dataSource.query(`SELECT id, full_name FROM users WHERE id = ANY($1)`, [unique]);
    return new Map(rows.map((r) => [r.id, r.full_name ?? '']));
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Chat not found', code: CHAT_ERRORS.NOT_FOUND });
  }
}
