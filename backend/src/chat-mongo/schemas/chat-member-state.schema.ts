import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatMemberStateDocument = HydratedDocument<ChatMemberState>;

/** One person's state in one chat (COM-03): what they have read, and whether they muted it. */
@Schema({ collection: 'chat_member_states', timestamps: true })
export class ChatMemberState {
  @Prop({ type: String, required: true })
  chatId: string;

  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: Date, default: null })
  lastReadAt: Date | null;

  @Prop({ type: Boolean, default: false })
  muted: boolean;
}

export const ChatMemberStateSchema = SchemaFactory.createForClass(ChatMemberState);
ChatMemberStateSchema.index({ chatId: 1, userId: 1 }, { unique: true });
ChatMemberStateSchema.index({ userId: 1 });
