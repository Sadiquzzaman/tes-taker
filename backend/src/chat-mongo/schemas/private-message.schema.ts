import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  DiscussionAttachment,
  DiscussionAttachmentSchema,
} from './discussion-attachment.schema';

export type PrivateMessageDocument = HydratedDocument<PrivateMessage>;

@Schema({ collection: 'private_messages', timestamps: true })
export class PrivateMessage {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  conversationId: string;

  @Prop({ type: String, required: true })
  senderId: string;

  @Prop({ type: String, default: null })
  senderName: string | null;

  /** Empty string allowed when the message has attachments only. */
  @Prop({ type: String, default: '' })
  content: string;

  @Prop({ type: [DiscussionAttachmentSchema], default: [] })
  attachments: DiscussionAttachment[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const PrivateMessageSchema = SchemaFactory.createForClass(PrivateMessage);

PrivateMessageSchema.index({ conversationId: 1, isActive: 1, createdAt: 1 });
