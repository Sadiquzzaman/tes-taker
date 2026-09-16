import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';

export type DiscussionAttachmentKind = 'image' | 'file';

@Schema({ _id: false })
export class DiscussionAttachment {
  @Prop({ type: String, default: () => randomUUID() })
  id: string;

  @Prop({ type: String, required: true })
  key: string;

  @Prop({ type: String, required: true })
  url: string;

  @Prop({ type: String, required: true })
  file_name: string;

  @Prop({ type: String, required: true })
  mime_type: string;

  @Prop({ type: Number, required: true })
  size: number;

  @Prop({ type: String, enum: ['image', 'file'], required: true })
  kind: DiscussionAttachmentKind;
}

export const DiscussionAttachmentSchema = SchemaFactory.createForClass(DiscussionAttachment);
