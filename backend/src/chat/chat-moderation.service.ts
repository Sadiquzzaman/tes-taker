import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { MoreThan, Repository } from 'typeorm';
import { SectionsService } from 'src/academics/sections.service';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { ChatUserMute } from 'src/chat-mongo/schemas/chat-user-mute.schema';
import { DirectChat } from 'src/chat-mongo/schemas/direct-chat.schema';
import { GroupChat } from 'src/chat-mongo/schemas/group-chat.schema';
import { GroupMessage } from 'src/chat-mongo/schemas/group-message.schema';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { NOTIFICATION_EVENTS } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { ChatBroadcaster } from './chat-broadcaster';
import { ChatDirectService } from './chat-direct.service';
import { CHAT_ERRORS } from './chat-errors';
import { ChatGroupsService } from './chat-groups.service';
import { ChatMessagesService, ChatMessageView, Timestamped } from './chat-messages.service';
import { ListChatMessagesQueryDto } from './dto/chat.dto';
import { ActiveStatusEnum } from 'src/common/enums/active-status.enum';
import { ChatAccessLogEntity, ChatTypeEnum } from './entities/chat-access-log.entity';
import { MessageReportEntity, MessageReportResolutionEnum, MessageReportStatusEnum, ReportedMessage } from './entities/message-report.entity';

/** An opening with a reason lets the admin act on that chat for this long. */
const ACCESS_WINDOW_MS = 2 * 60 * 60_000;
/** Messages on each side of a reported one, kept with the report (COM-05). */
const CONTEXT = 5;

export interface AdminChatView {
  type: ChatTypeEnum;
  id: string;
  label: string;
  closed: boolean;
  last_activity: Date | null;
}

type Chat = { type: ChatTypeEnum; doc: GroupChat | DirectChat; label: string; teacherIds: string[] };

/**
 * Supervising chats (Epic 7, COM-04, COM-05, COM-06). Owners and admins see every chat of the
 * organisation and open one only with a reason, which is logged (the owner reads the log); for 2
 * hours after that they read it, delete messages, mute a person in it for a while, and close or
 * reopen it (all audited). They never appear as a participant. Members report a message; the
 * report keeps the 5 messages before and after as they were and goes to the owners' and admins'
 * queue, where it is resolved (message kept or deleted).
 */
@Injectable()
export class ChatModerationService {
  constructor(
    @InjectModel(GroupChat.name) private readonly groups: Model<GroupChat>,
    @InjectModel(DirectChat.name) private readonly directs: Model<DirectChat>,
    @InjectModel(GroupMessage.name) private readonly messages: Model<GroupMessage>,
    @InjectModel(ChatUserMute.name) private readonly mutes: Model<ChatUserMute>,
    @InjectRepository(ChatAccessLogEntity) private readonly logs: Repository<ChatAccessLogEntity>,
    @InjectRepository(MessageReportEntity) private readonly reports: Repository<MessageReportEntity>,
    private readonly sections: SectionsService,
    private readonly groupChats: ChatGroupsService,
    private readonly directChats: ChatDirectService,
    private readonly chatMessages: ChatMessagesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  // ------------------------------------------------------------------ admin access (COM-04)

  /** Every chat of the organisation (names only; nothing is read until opened with a reason). */
  async chats(tenant: Tenant): Promise<AdminChatView[]> {
    this.assertAdmin(tenant);
    const [groups, directs] = await Promise.all([
      this.groups.find({ organizationId: tenant.organizationId }).lean<GroupChat[]>(),
      this.directs.find({ organizationId: tenant.organizationId }).lean<DirectChat[]>(),
    ]);
    const labels = await this.groupLabels(tenant.organizationId, groups);
    const names = await this.chatMessages.userNames(directs.flatMap((d) => [d.studentId, d.teacherId]));
    const lasts = new Map(
      (
        await this.messages
          .aggregate<{ _id: string; at: Date }>([{ $match: { groupId: { $in: [...groups, ...directs].map((c) => c._id) } } }, { $group: { _id: '$groupId', at: { $max: '$createdAt' } } }])
          .exec()
      ).map((row) => [row._id, row.at]),
    );
    const views: AdminChatView[] = [
      ...groups.map((g) => ({ type: ChatTypeEnum.GROUP, id: g._id, label: labels.get(g._id) ?? '', closed: Boolean(g.closedAt), last_activity: lasts.get(g._id) ?? null })),
      ...directs.map((d) => ({ type: ChatTypeEnum.DIRECT, id: d._id, label: `${names.get(d.teacherId) ?? ''} ↔ ${names.get(d.studentId) ?? ''}`, closed: Boolean(d.closedAt), last_activity: lasts.get(d._id) ?? null })),
    ];
    return views.sort((a, b) => (b.last_activity?.getTime() ?? 0) - (a.last_activity?.getTime() ?? 0) || a.label.localeCompare(b.label));
  }

  /** Opens a chat with a reason (logged), and returns its latest messages. */
  async open(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, reason: string) {
    this.assertAdmin(tenant);
    this.assertReason(reason);
    const chat = await this.findChat(tenant, type, chatId);
    await this.logs.insert({ organization_id: tenant.organizationId, actor_id: actorId, chat_type: type, chat_id: chatId, reason: reason.trim() });
    return { chat: this.summary(chat), messages: await this.history(tenant, actorId, type, chatId, {}) };
  }

  /** Messages of a chat the admin opened in the last 2 hours: posts, comments and private messages, newest first. */
  async history(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, query: Pick<ListChatMessagesQueryDto, 'before' | 'limit'>): Promise<ChatMessageView[]> {
    const chat = await this.openedChat(tenant, actorId, type, chatId);
    const rows = await this.messages
      .find({ groupId: chatId, ...(query.before ? { createdAt: { $lt: new Date(query.before) } } : {}) })
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .lean<Timestamped<GroupMessage>[]>();
    return this.chatMessages.views(rows, { teacherIds: chat.teacherIds, pinnedIds: type === ChatTypeEnum.GROUP ? (chat.doc as GroupChat).pinnedIds : [] });
  }

  async deleteMessage(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, messageId: string): Promise<void> {
    await this.openedChat(tenant, actorId, type, chatId);
    await this.softDelete(tenant, actorId, type, chatId, messageId, 'admin');
  }

  /** Stops one member writing in the chat for `hours` (the mute replaces an earlier one). */
  async muteUser(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, userId: string, hours: number, reason: string) {
    const chat = await this.openedChat(tenant, actorId, type, chatId);
    if (!(await this.isMember(tenant, chat, userId))) throw new NotFoundException({ message: 'This person is not in the chat', code: CHAT_ERRORS.NOT_FOUND });
    const until = new Date(Date.now() + hours * 60 * 60_000);
    await this.mutes.updateOne({ chatId, userId }, { $set: { until, mutedBy: actorId, reason: reason.trim() } }, { upsert: true });
    this.audit.record({
      action: AUDIT_ACTIONS.CHAT_USER_MUTE,
      organizationId: tenant.organizationId,
      actorId,
      entityType: type === ChatTypeEnum.GROUP ? 'group_chat' : 'direct_chat',
      entityId: chatId,
      after: { user_id: userId, until, reason: reason.trim() },
    });
    return { user_id: userId, until };
  }

  /** Closes a chat (read-only for everyone) or reopens it. */
  async close(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, closed: boolean) {
    const chat = await this.openedChat(tenant, actorId, type, chatId);
    const model = (type === ChatTypeEnum.GROUP ? this.groups : this.directs) as Model<GroupChat | DirectChat>;
    await model.updateOne({ _id: chatId }, { $set: closed ? { closedAt: new Date(), closedBy: actorId } : { closedAt: null, closedBy: null } });
    this.audit.record({
      action: AUDIT_ACTIONS.CHAT_CLOSE,
      organizationId: tenant.organizationId,
      actorId,
      entityType: type === ChatTypeEnum.GROUP ? 'group_chat' : 'direct_chat',
      entityId: chatId,
      before: { closed: Boolean(chat.doc.closedAt) },
      after: { closed },
    });
    return { closed };
  }

  /** Who opened which chat, when and why: the owner only (COM-04). */
  async accessLog(tenant: Tenant) {
    if (tenant.memberRole !== OrganizationMemberRoleEnum.OWNER) {
      throw new ForbiddenException({ message: 'Only the owner can see who opened chats', code: CHAT_ERRORS.NOT_ADMIN });
    }
    const rows = await this.logs.find({ where: { organization_id: tenant.organizationId }, order: { opened_at: 'DESC' }, take: 500 });
    const names = await this.chatMessages.userNames(rows.map((r) => r.actor_id));
    const labels = await this.chatLabels(tenant, rows.map((r) => ({ type: r.chat_type, id: r.chat_id })));
    return rows.map((r) => ({ id: r.id, actor: { id: r.actor_id, name: names.get(r.actor_id) ?? '' }, chat_type: r.chat_type, chat_id: r.chat_id, chat_label: labels.get(r.chat_id) ?? '', reason: r.reason, opened_at: r.opened_at }));
  }

  // ------------------------------------------------------------------ reports (COM-05)

  /** A member reports a message: the queue gets it with the 5 messages before and after. */
  async report(tenant: Tenant, userId: string, type: ChatTypeEnum, chatId: string, messageId: string, reason: string) {
    this.assertReason(reason);
    if (type === ChatTypeEnum.GROUP) await this.groupChats.memberAccess(tenant, userId, chatId);
    else await this.directChats.participant(tenant, userId, chatId);
    const message = await this.messages.findOne({ _id: messageId, groupId: chatId, deletedAt: null }).lean<Timestamped<GroupMessage>>();
    if (!message) throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    if (await this.reports.exists({ where: { message_id: messageId, reporter_id: userId } })) {
      throw new ConflictException({ message: 'You already reported this message', code: CHAT_ERRORS.ALREADY_REPORTED });
    }
    const [before, after] = await Promise.all([
      this.messages.find({ groupId: chatId, createdAt: { $lt: message.createdAt } }).sort({ createdAt: -1 }).limit(CONTEXT).lean<Timestamped<GroupMessage>[]>(),
      this.messages.find({ groupId: chatId, createdAt: { $gt: message.createdAt } }).sort({ createdAt: 1 }).limit(CONTEXT).lean<Timestamped<GroupMessage>[]>(),
    ]);
    const rows = [...before.reverse(), message, ...after];
    const names = await this.chatMessages.userNames([...rows.map((r) => r.authorId), userId]);
    const context: ReportedMessage[] = rows.map((r) => ({
      id: r._id,
      author_id: r.authorId,
      author_name: names.get(r.authorId) ?? '',
      content: r.deletedAt ? '' : r.content,
      files: r.deletedAt ? [] : r.attachments.map((a) => a.name),
      created_at: r.createdAt.toISOString(),
      reported: r._id === messageId,
    }));
    const saved = await this.reports.save(
      this.reports.create({ organization_id: tenant.organizationId, chat_type: type, chat_id: chatId, message_id: messageId, reporter_id: userId, reason: reason.trim(), context }),
    );
    const admins: { user_id: string }[] = await this.reports.manager.query(
      `SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = ANY($2) AND is_active = $3`,
      [tenant.organizationId, [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN], ActiveStatusEnum.ACTIVE],
    );
    await this.notifications.notifyUsers({
      eventType: NOTIFICATION_EVENTS.CHAT_MESSAGE_REPORTED,
      organizationId: tenant.organizationId,
      userIds: admins.map((a) => a.user_id).filter((id) => id !== userId),
      variables: { reporter: names.get(userId) ?? '', reason: reason.trim(), path: '/chat-admin?tab=reports' },
      dedupeKey: `${NOTIFICATION_EVENTS.CHAT_MESSAGE_REPORTED}:${saved.id}`,
    });
    return { id: saved.id };
  }

  async reportQueue(tenant: Tenant, status: MessageReportStatusEnum = MessageReportStatusEnum.OPEN) {
    this.assertAdmin(tenant);
    const rows = await this.reports.find({ where: { organization_id: tenant.organizationId, status }, order: { created_at: 'DESC' }, take: 200 });
    const names = await this.chatMessages.userNames(rows.flatMap((r) => [r.reporter_id, ...(r.resolved_by ? [r.resolved_by] : [])]));
    const labels = await this.chatLabels(tenant, rows.map((r) => ({ type: r.chat_type, id: r.chat_id })));
    return rows.map((r) => ({
      id: r.id,
      chat_type: r.chat_type,
      chat_id: r.chat_id,
      chat_label: labels.get(r.chat_id) ?? '',
      message_id: r.message_id,
      reporter: { id: r.reporter_id, name: names.get(r.reporter_id) ?? '' },
      reason: r.reason,
      context: r.context,
      status: r.status,
      resolution: r.resolution,
      resolved_by: r.resolved_by ? { id: r.resolved_by, name: names.get(r.resolved_by) ?? '' } : null,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
    }));
  }

  /** Resolves a report: the message stays (KEPT) or is deleted (DELETED); other open reports of it close too. */
  async resolve(tenant: Tenant, actorId: string, reportId: string, resolution: MessageReportResolutionEnum) {
    this.assertAdmin(tenant);
    const report = await this.reports.findOne({ where: { id: reportId, organization_id: tenant.organizationId } });
    if (!report) throw new NotFoundException({ message: 'Report not found', code: CHAT_ERRORS.REPORT_NOT_FOUND });
    if (resolution === MessageReportResolutionEnum.DELETED) {
      await this.softDelete(tenant, actorId, report.chat_type, report.chat_id, report.message_id, 'report');
    }
    await this.reports.update(
      { organization_id: tenant.organizationId, message_id: report.message_id, status: MessageReportStatusEnum.OPEN },
      { status: MessageReportStatusEnum.RESOLVED, resolution, resolved_by: actorId, resolved_at: new Date() },
    );
    this.audit.record({
      action: AUDIT_ACTIONS.CHAT_REPORT_RESOLVE,
      organizationId: tenant.organizationId,
      actorId,
      entityType: 'message_report',
      entityId: report.id,
      after: { message_id: report.message_id, resolution },
    });
    return { id: report.id, resolution };
  }

  // ------------------------------------------------------------------ helpers

  private assertReason(reason: string): void {
    if (!reason.trim()) throw new BadRequestException({ message: 'Give a reason', code: CHAT_ERRORS.REASON_REQUIRED });
  }

  private assertAdmin(tenant: Tenant): void {
    if (tenant.memberRole !== OrganizationMemberRoleEnum.OWNER && tenant.memberRole !== OrganizationMemberRoleEnum.ADMIN) {
      throw new ForbiddenException({ message: 'Only owners and admins can review chats', code: CHAT_ERRORS.NOT_ADMIN });
    }
  }

  /** The chat, if the admin opened it with a reason in the last 2 hours. */
  private async openedChat(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string): Promise<Chat> {
    this.assertAdmin(tenant);
    const chat = await this.findChat(tenant, type, chatId);
    const opened = await this.logs.exists({ where: { actor_id: actorId, chat_id: chatId, organization_id: tenant.organizationId, opened_at: MoreThan(new Date(Date.now() - ACCESS_WINDOW_MS)) } });
    if (!opened) throw new ForbiddenException({ message: 'Open the chat with a reason first', code: CHAT_ERRORS.REASON_REQUIRED });
    return chat;
  }

  private async findChat(tenant: Tenant, type: ChatTypeEnum, chatId: string): Promise<Chat> {
    if (type === ChatTypeEnum.GROUP) {
      const doc = await this.groups.findOne({ _id: chatId, organizationId: tenant.organizationId }).lean<GroupChat>();
      if (!doc) this.notFound();
      const [entry] = await this.sections.offeringsWithTeachers(tenant.organizationId, [doc.offeringId]);
      return { type, doc, label: (await this.groupLabels(tenant.organizationId, [doc])).get(doc._id) ?? '', teacherIds: entry?.teacherIds ?? [] };
    }
    const doc = await this.directs.findOne({ _id: chatId, organizationId: tenant.organizationId }).lean<DirectChat>();
    if (!doc) this.notFound();
    const names = await this.chatMessages.userNames([doc.teacherId, doc.studentId]);
    return { type, doc, label: `${names.get(doc.teacherId) ?? ''} ↔ ${names.get(doc.studentId) ?? ''}`, teacherIds: [doc.teacherId] };
  }

  private summary(chat: Chat): AdminChatView {
    return { type: chat.type, id: chat.doc._id, label: chat.label, closed: Boolean(chat.doc.closedAt), last_activity: null };
  }

  private async isMember(tenant: Tenant, chat: Chat, userId: string): Promise<boolean> {
    if (chat.type === ChatTypeEnum.DIRECT) {
      const doc = chat.doc as DirectChat;
      return doc.studentId === userId || doc.teacherId === userId;
    }
    if (chat.teacherIds.includes(userId)) return true;
    const [entry] = await this.sections.offeringsWithTeachers(tenant.organizationId, [(chat.doc as GroupChat).offeringId]);
    return Boolean(entry) && (await this.groupChats.studentIdsOf(entry.offering)).includes(userId);
  }

  private async softDelete(tenant: Tenant, actorId: string, type: ChatTypeEnum, chatId: string, messageId: string, via: 'admin' | 'report'): Promise<void> {
    const message = await this.messages.findOne({ _id: messageId, groupId: chatId }).lean<GroupMessage>();
    if (!message) throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    if (message.deletedAt) return;
    await this.messages.updateOne({ _id: messageId }, { $set: { deletedAt: new Date(), deletedBy: actorId, content: '', attachments: [] } });
    if (message.parentId) await this.messages.updateOne({ _id: message.parentId }, { $inc: { commentCount: -1 } });
    if (type === ChatTypeEnum.GROUP) {
      await this.groups.updateOne({ _id: chatId }, { $pull: { pinnedIds: messageId } });
      this.broadcaster.toGroup(chatId, 'chat:deleted', { group_id: chatId, id: messageId, parent_id: message.parentId });
    } else {
      this.broadcaster.toDirect(chatId, 'chat:deleted', { group_id: chatId, id: messageId, parent_id: null });
    }
    this.audit.record({
      action: AUDIT_ACTIONS.CHAT_ADMIN_DELETE,
      organizationId: tenant.organizationId,
      actorId,
      entityType: type === ChatTypeEnum.GROUP ? 'group_chat' : 'direct_chat',
      entityId: chatId,
      before: { message_id: messageId, author_id: message.authorId, content: message.content, files: message.attachments.length, via },
    });
  }

  private async groupLabels(organizationId: string, groups: GroupChat[]): Promise<Map<string, string>> {
    const offerings = await this.sections.offeringsWithTeachers(organizationId, groups.map((g) => g.offeringId));
    const byOffering = new Map(
      offerings.map(({ offering }) => [offering.id, `${`${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim()} · ${offering.subject?.name ?? ''}`]),
    );
    return new Map(groups.map((g) => [g._id, byOffering.get(g.offeringId) ?? '']));
  }

  private async chatLabels(tenant: Tenant, refs: { type: ChatTypeEnum; id: string }[]): Promise<Map<string, string>> {
    const groupIds = refs.filter((r) => r.type === ChatTypeEnum.GROUP).map((r) => r.id);
    const directIds = refs.filter((r) => r.type === ChatTypeEnum.DIRECT).map((r) => r.id);
    const [groups, directs] = await Promise.all([
      groupIds.length ? this.groups.find({ _id: { $in: groupIds }, organizationId: tenant.organizationId }).lean<GroupChat[]>() : [],
      directIds.length ? this.directs.find({ _id: { $in: directIds }, organizationId: tenant.organizationId }).lean<DirectChat[]>() : [],
    ]);
    const labels = await this.groupLabels(tenant.organizationId, groups);
    const names = await this.chatMessages.userNames(directs.flatMap((d) => [d.studentId, d.teacherId]));
    for (const d of directs) labels.set(d._id, `${names.get(d.teacherId) ?? ''} ↔ ${names.get(d.studentId) ?? ''}`);
    return labels;
  }

  private notFound(): never {
    throw new NotFoundException({ message: 'Chat not found', code: CHAT_ERRORS.NOT_FOUND });
  }
}
