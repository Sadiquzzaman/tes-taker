import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type GroupMessageDocument = HydratedDocument<GroupMessage>;

/** A file on a message: an upload of the files module (purpose DISCUSSION). */
@Schema({ _id: false })
export class ChatAttachment {
  @Prop({ type: String, required: true })
  fileId: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  mime: string;

  @Prop({ type: Number, required: true })
  size: number;
}
export const ChatAttachmentSchema = SchemaFactory.createForClass(ChatAttachment);

/**
 * A post in a group chat (`parentId` null) or a comment on a post (`parentId` = the post, design
 * §9.11). Posts count their comments. Deleting keeps the row (soft delete, content cleared).
 */
@Schema({ collection: 'group_messages', timestamps: true })
export class GroupMessage {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true })
  groupId: string;

  @Prop({ type: String, required: true })
  organizationId: string;

  @Prop({ type: String, default: null })
  parentId: string | null;

  /** The message this one answers (a reply quotes it). */
  @Prop({ type: String, default: null })
  replyToId: string | null;

  @Prop({ type: String, required: true })
  authorId: string;

  @Prop({ type: String, default: '' })
  content: string;

  @Prop({ type: [ChatAttachmentSchema], default: [] })
  attachments: ChatAttachment[];

  @Prop({ type: Number, default: 0 })
  commentCount: number;

  @Prop({ type: Date, default: null })
  lastCommentAt: Date | null;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: String, default: null })
  deletedBy: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const GroupMessageSchema = SchemaFactory.createForClass(GroupMessage);
GroupMessageSchema.index({ groupId: 1, parentId: 1, createdAt: 1 });
GroupMessageSchema.index({ groupId: 1, createdAt: 1 });
