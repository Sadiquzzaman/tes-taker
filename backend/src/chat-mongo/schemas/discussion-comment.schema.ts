import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type DiscussionCommentDocument = HydratedDocument<DiscussionComment>;

@Schema({ collection: 'discussion_comments', timestamps: true })
export class DiscussionComment {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, required: true, index: true })
  postId: string;

  @Prop({ type: String, required: true })
  authorId: string;

  @Prop({ type: String, default: null })
  authorName: string | null;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const DiscussionCommentSchema = SchemaFactory.createForClass(DiscussionComment);

DiscussionCommentSchema.index({ postId: 1, isActive: 1, createdAt: 1 });
