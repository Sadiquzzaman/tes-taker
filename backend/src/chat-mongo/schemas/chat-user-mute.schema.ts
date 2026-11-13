import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatUserMuteDocument = HydratedDocument<ChatUserMute>;

/** An owner or admin stopped one person writing in one chat until `until` (COM-04). */
@Schema({ collection: 'chat_user_mutes', timestamps: true })
export class ChatUserMute {
  @Prop({ type: String, required: true })
  chatId: string;

  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: Date, required: true })
  until: Date;

  @Prop({ type: String, required: true })
  mutedBy: string;

  @Prop({ type: String, default: '' })
  reason: string;
}

export const ChatUserMuteSchema = SchemaFactory.createForClass(ChatUserMute);
ChatUserMuteSchema.index({ chatId: 1, userId: 1 }, { unique: true });
