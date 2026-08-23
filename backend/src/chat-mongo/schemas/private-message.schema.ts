import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

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

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const PrivateMessageSchema = SchemaFactory.createForClass(PrivateMessage);

PrivateMessageSchema.index({ conversationId: 1, isActive: 1, createdAt: 1 });
