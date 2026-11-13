import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type DirectChatDocument = HydratedDocument<DirectChat>;

/**
 * A private chat between a student and a teacher who teaches them (COM-02), one per pair in an
 * organisation. Its messages are in `group_messages` with `groupId` = this id.
 */
@Schema({ collection: 'direct_chats', timestamps: true })
export class DirectChat {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true })
  organizationId: string;

  @Prop({ type: String, required: true })
  studentId: string;

  @Prop({ type: String, required: true })
  teacherId: string;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;

  /** Closed by an owner or admin (COM-04): read-only until reopened. */
  @Prop({ type: Date, default: null })
  closedAt: Date | null;

  @Prop({ type: String, default: null })
  closedBy: string | null;
}

export const DirectChatSchema = SchemaFactory.createForClass(DirectChat);
DirectChatSchema.index({ organizationId: 1, studentId: 1, teacherId: 1 }, { unique: true });
DirectChatSchema.index({ organizationId: 1, teacherId: 1, lastMessageAt: -1 });
