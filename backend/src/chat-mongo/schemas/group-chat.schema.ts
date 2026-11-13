import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type GroupChatDocument = HydratedDocument<GroupChat>;

/**
 * One group chat per subject class (course offering, COM-01): its members are the subject
 * class's students and teachers. Made the first time anyone opens their chats.
 */
@Schema({ collection: 'group_chats', timestamps: true })
export class GroupChat {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  organizationId: string;

  @Prop({ type: String, required: true })
  offeringId: string;

  @Prop({ type: String, required: true })
  sessionId: string;

  /** "Only teachers can post": students still comment on posts. */
  @Prop({ type: Boolean, default: false })
  announcementOnly: boolean;

  /** Pinned posts, newest pin first (at most 3). */
  @Prop({ type: [String], default: [] })
  pinnedIds: string[];
}

export const GroupChatSchema = SchemaFactory.createForClass(GroupChat);
GroupChatSchema.index({ offeringId: 1 }, { unique: true });
