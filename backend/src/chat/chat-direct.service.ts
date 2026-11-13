import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OfferingRosterService } from 'src/academics/offering-roster.service';
import { SectionsService } from 'src/academics/sections.service';
import { ChatMemberState } from 'src/chat-mongo/schemas/chat-member-state.schema';
import { DirectChat } from 'src/chat-mongo/schemas/direct-chat.schema';
import { GroupMessage } from 'src/chat-mongo/schemas/group-message.schema';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { NOTIFICATION_EVENTS } from 'src/notifications/notification.constants';
import { NotificationsService } from 'src/notifications/notifications.service';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { ChatBroadcaster } from './chat-broadcaster';
import { CHAT_ERRORS } from './chat-errors';
import { ChatMessagesService, ChatMessageView, Timestamped } from './chat-messages.service';
import { ListChatMessagesQueryDto, MAX_MESSAGE_LENGTH, SendChatMessageDto } from './dto/chat.dto';

/** At most one "new message" notice per private chat in this many minutes. */
const NOTICE_EVERY_MINUTES = 10;

export interface DirectContact {
  id: string;
  name: string;
  /** What links you: "Class 6 A · Math" (the subject classes they teach you, or you teach them). */
  via: string[];
}

export interface DirectChatView {
  id: string;
  other: { id: string; name: string; is_teacher: boolean };
  unread: number;
  /** When the other person last read the chat (read receipts). */
  other_read_at: Date | null;
  muted: boolean;
  last_message: { author_name: string; preview: string; created_at: Date } | null;
}

type Side = { chat: DirectChat; meIsTeacher: boolean; otherId: string };

/**
 * Private teacher–student chats (Epic 7, COM-02): a student starts one only with a teacher who
 * teaches them, a teacher with any student they teach (a subject class in an open session in
 * common). Text and files, replies, deleting your own message, read receipts (the other's last
 * read time), and an in-app notice to the other person at most every 10 minutes per chat.
 */
@Injectable()
export class ChatDirectService {
  constructor(
    @InjectModel(DirectChat.name) private readonly chats: Model<DirectChat>,
    @InjectModel(GroupMessage.name) private readonly messages: Model<GroupMessage>,
    @InjectModel(ChatMemberState.name) private readonly states: Model<ChatMemberState>,
    private readonly sections: SectionsService,
    private readonly roster: OfferingRosterService,
    private readonly chatMessages: ChatMessagesService,
    private readonly notifications: NotificationsService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  /** Who the caller may message: a student their teachers, a teacher their students. */
  async contacts(tenant: Tenant, userId: string): Promise<DirectContact[]> {
    const contacts = new Map<string, Set<string>>();
    const add = (id: string, via: string) => contacts.set(id, (contacts.get(id) ?? new Set()).add(via));
    if (this.isStudent(tenant)) {
      const offerings = await this.sections.offeringsWithTeachers(tenant.organizationId, await this.roster.offeringIdsOfStudent(tenant.organizationId, userId));
      for (const { offering, teacherIds } of offerings) for (const id of teacherIds) add(id, this.label(offering));
    } else {
      const offerings = await this.sections.offeringsWithTeachers(tenant.organizationId, await this.sections.offeringIdsTaughtBy(tenant.organizationId, userId));
      for (const { offering } of offerings) for (const student of await this.roster.students(offering)) add(student.student_id, this.label(offering));
    }
    contacts.delete(userId);
    const names = await this.chatMessages.userNames([...contacts.keys()]);
    return [...contacts.entries()]
      .map(([id, via]) => ({ id, name: names.get(id) ?? '', via: [...via].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The caller's private chats, most recent first, with unread counts and read receipts. */
  async list(tenant: Tenant, userId: string): Promise<DirectChatView[]> {
    const field = this.isStudent(tenant) ? 'studentId' : 'teacherId';
    const chats = await this.chats.find({ organizationId: tenant.organizationId, [field]: userId }).sort({ lastMessageAt: -1, createdAt: -1 }).lean<DirectChat[]>();
    return Promise.all(chats.map((chat) => this.view(chat, userId)));
  }

  async get(tenant: Tenant, userId: string, chatId: string): Promise<DirectChatView> {
    const { chat } = await this.side(tenant, userId, chatId);
    return this.view(chat, userId);
  }

  /** Opens (or finds) the private chat with someone the caller may message. */
  async start(tenant: Tenant, userId: string, otherId: string): Promise<DirectChatView> {
    if (otherId === userId || !(await this.allowed(tenant, userId, otherId))) {
      throw new ForbiddenException({ message: 'You can message only your own teachers or students', code: CHAT_ERRORS.NOT_YOUR_STUDENT_OR_TEACHER });
    }
    const pair = this.isStudent(tenant) ? { studentId: userId, teacherId: otherId } : { studentId: otherId, teacherId: userId };
    const chat = await this.chats
      .findOneAndUpdate(
        { organizationId: tenant.organizationId, ...pair },
        { $setOnInsert: { organizationId: tenant.organizationId, ...pair } },
        { upsert: true, new: true },
      )
      .lean<DirectChat>();
    this.broadcaster.joinDirect(pair.studentId, chat._id);
    this.broadcaster.joinDirect(pair.teacherId, chat._id);
    return this.view(chat, userId);
  }

  async history(tenant: Tenant, userId: string, chatId: string, query: ListChatMessagesQueryDto): Promise<ChatMessageView[]> {
    const side = await this.side(tenant, userId, chatId);
    const rows = await this.messages
      .find({ groupId: chatId, ...(query.before ? { createdAt: { $lt: new Date(query.before) } } : {}) })
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 30)
      .lean<Timestamped<GroupMessage>[]>();
    return this.chatMessages.views(rows, { teacherIds: [side.chat.teacherId] });
  }

  async send(tenant: Tenant, userId: string, chatId: string, dto: SendChatMessageDto): Promise<ChatMessageView> {
    const side = await this.side(tenant, userId, chatId);
    const content = (dto.content ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
    const fileIds = [...new Set(dto.file_ids ?? [])];
    if (!content && fileIds.length === 0) {
      throw new BadRequestException({ message: 'Write a message or add a file', code: CHAT_ERRORS.EMPTY });
    }
    if (dto.reply_to_id && !(await this.messages.exists({ _id: dto.reply_to_id, groupId: chatId }))) {
      throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    }
    const attachments = await this.chatMessages.attachments(tenant.organizationId, userId, fileIds);
    const created = await this.messages.create({
      groupId: chatId,
      organizationId: tenant.organizationId,
      parentId: null,
      replyToId: dto.reply_to_id ?? null,
      authorId: userId,
      content,
      attachments,
    });
    await this.chats.updateOne({ _id: chatId }, { $set: { lastMessageAt: created.createdAt } });
    await this.states.updateOne({ chatId, userId }, { $set: { lastReadAt: created.createdAt } }, { upsert: true });
    const [view] = await this.chatMessages.views([created.toObject() as Timestamped<GroupMessage>], { teacherIds: [side.chat.teacherId] });
    this.broadcaster.toDirect(chatId, 'chat:message', view);
    await this.notify(tenant, side, view);
    return view;
  }

  async remove(tenant: Tenant, userId: string, chatId: string, messageId: string): Promise<void> {
    await this.side(tenant, userId, chatId);
    const message = await this.messages.findOne({ _id: messageId, groupId: chatId, deletedAt: null }).lean<GroupMessage>();
    if (!message) throw new NotFoundException({ message: 'Message not found', code: CHAT_ERRORS.MESSAGE_NOT_FOUND });
    if (message.authorId !== userId) {
      throw new ForbiddenException({ message: 'You can delete only your own messages', code: CHAT_ERRORS.NOT_AUTHOR });
    }
    await this.messages.updateOne({ _id: messageId }, { $set: { deletedAt: new Date(), deletedBy: userId, content: '', attachments: [] } });
    this.broadcaster.toDirect(chatId, 'chat:deleted', { group_id: chatId, id: messageId, parent_id: null });
  }

  /** Marks the chat read; the other person sees it (read receipt). */
  async markRead(tenant: Tenant, userId: string, chatId: string): Promise<void> {
    await this.side(tenant, userId, chatId);
    const at = new Date();
    await this.states.updateOne({ chatId, userId }, { $set: { lastReadAt: at } }, { upsert: true });
    this.broadcaster.toDirect(chatId, 'chat:read', { chat_id: chatId, user_id: userId, at });
  }

  /** No inbox notices from this chat for the caller (COM-03). */
  async mute(tenant: Tenant, userId: string, chatId: string, muted: boolean) {
    await this.side(tenant, userId, chatId);
    await this.states.updateOne({ chatId, userId }, { $set: { muted } }, { upsert: true });
    return { muted };
  }

  /** The private chat ids a person's sockets join. */
  async chatIdsOf(member: Pick<Tenant, 'organizationId' | 'memberRole'>, userId: string): Promise<string[]> {
    const field = member.memberRole === OrganizationMemberRoleEnum.STUDENT ? 'studentId' : 'teacherId';
    return (await this.chats.find({ organizationId: member.organizationId, [field]: userId }, { _id: 1 }).lean()).map((c) => c._id);
  }

  // ------------------------------------------------------------------ helpers

  private isStudent(tenant: Pick<Tenant, 'memberRole'>): boolean {
    return tenant.memberRole === OrganizationMemberRoleEnum.STUDENT;
  }

  /** A subject class in an open session that the teacher teaches and the student takes. */
  private async allowed(tenant: Tenant, userId: string, otherId: string): Promise<boolean> {
    const [studentId, teacherId] = this.isStudent(tenant) ? [userId, otherId] : [otherId, userId];
    const [taught, taken] = await Promise.all([
      this.sections.offeringIdsTaughtBy(tenant.organizationId, teacherId),
      this.roster.offeringIdsOfStudent(tenant.organizationId, studentId),
    ]);
    return taught.some((id) => taken.includes(id));
  }

  /** One of the chat's two people (in this organisation), else 404. */
  private async side(tenant: Tenant, userId: string, chatId: string): Promise<Side> {
    const chat = await this.chats.findOne({ _id: chatId, organizationId: tenant.organizationId }).lean<DirectChat>();
    if (!chat || (chat.studentId !== userId && chat.teacherId !== userId)) {
      throw new NotFoundException({ message: 'Chat not found', code: CHAT_ERRORS.NOT_FOUND });
    }
    const meIsTeacher = chat.teacherId === userId;
    return { chat, meIsTeacher, otherId: meIsTeacher ? chat.studentId : chat.teacherId };
  }

  private async view(chat: DirectChat, userId: string): Promise<DirectChatView> {
    const otherId = chat.teacherId === userId ? chat.studentId : chat.teacherId;
    const [mine, theirs, last] = await Promise.all([
      this.states.findOne({ chatId: chat._id, userId }).lean(),
      this.states.findOne({ chatId: chat._id, userId: otherId }).lean(),
      this.messages.findOne({ groupId: chat._id, deletedAt: null }).sort({ createdAt: -1 }).lean<Timestamped<GroupMessage>>(),
    ]);
    const unread = await this.messages.countDocuments({
      groupId: chat._id,
      deletedAt: null,
      authorId: { $ne: userId },
      ...(mine?.lastReadAt ? { createdAt: { $gt: mine.lastReadAt } } : {}),
    });
    const names = await this.chatMessages.userNames([otherId, ...(last ? [last.authorId] : [])]);
    return {
      id: chat._id,
      other: { id: otherId, name: names.get(otherId) ?? '', is_teacher: otherId === chat.teacherId },
      unread,
      other_read_at: theirs?.lastReadAt ?? null,
      muted: mine?.muted ?? false,
      last_message: last ? { author_name: names.get(last.authorId) ?? '', preview: this.chatMessages.preview(last), created_at: last.createdAt } : null,
    };
  }

  /** The other person hears about it in the inbox, unless they muted the chat; once per 10 minutes. */
  private async notify(tenant: Tenant, side: Side, view: ChatMessageView): Promise<void> {
    const muted = await this.states.exists({ chatId: side.chat._id, userId: side.otherId, muted: true });
    if (muted) return;
    const bucket = Math.floor(Date.now() / (NOTICE_EVERY_MINUTES * 60_000));
    await this.notifications.notifyUsers({
      eventType: NOTIFICATION_EVENTS.CHAT_DIRECT_MESSAGE,
      organizationId: tenant.organizationId,
      userIds: [side.otherId],
      variables: { author: view.author.name, preview: this.chatMessages.preview({ content: view.content, attachments: view.attachments }), path: `/chat?direct=${side.chat._id}` },
      dedupeKey: `${NOTIFICATION_EVENTS.CHAT_DIRECT_MESSAGE}:${side.chat._id}:${bucket}`,
    });
  }

  private label(offering: { section?: { name?: string; class?: { class_name?: string } | null } | null; subject?: { name?: string } | null }): string {
    return `${`${offering.section?.class?.class_name ?? ''} ${offering.section?.name ?? ''}`.trim()} · ${offering.subject?.name ?? ''}`;
  }
}
