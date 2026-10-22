import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type PrivateConversationDocument = HydratedDocument<PrivateConversation>;

@Schema({ collection: 'private_conversations', timestamps: true })
export class PrivateConversation {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, default: null, index: true })
  organizationId: string | null;

  @Prop({ type: String, required: true, index: true })
  classId: string;

  @Prop({ type: String, required: true, index: true })
  classSubjectId: string;

  @Prop({ type: String, required: true })
  subjectId: string;

  @Prop({ type: String, required: true, index: true })
  studentId: string;

  @Prop({ type: String, required: true, index: true })
  teacherId: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const PrivateConversationSchema = SchemaFactory.createForClass(PrivateConversation);

PrivateConversationSchema.index(
  { classSubjectId: 1, studentId: 1, teacherId: 1 },
  { unique: true },
);
PrivateConversationSchema.index({ classSubjectId: 1, studentId: 1, updatedAt: -1 });
PrivateConversationSchema.index({ classSubjectId: 1, teacherId: 1, updatedAt: -1 });
