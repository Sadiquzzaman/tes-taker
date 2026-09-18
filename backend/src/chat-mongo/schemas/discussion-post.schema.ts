import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  DiscussionAttachment,
  DiscussionAttachmentSchema,
} from './discussion-attachment.schema';

export type DiscussionPostDocument = HydratedDocument<DiscussionPost>;

export type DiscussionPostCategory = 'general' | 'question' | 'idea' | 'resource';

@Schema({ collection: 'discussion_posts', timestamps: true })
export class DiscussionPost {
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
  authorId: string;

  @Prop({ type: String, default: null })
  authorName: string | null;

  /** Empty string allowed when the post has attachments only. */
  @Prop({ type: String, default: '' })
  content: string;

  @Prop({
    type: String,
    enum: ['general', 'question', 'idea', 'resource'],
    default: 'general',
    index: true,
  })
  category: DiscussionPostCategory;

  @Prop({ type: [DiscussionAttachmentSchema], default: [] })
  attachments: DiscussionAttachment[];

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const DiscussionPostSchema = SchemaFactory.createForClass(DiscussionPost);

DiscussionPostSchema.index({ organizationId: 1, classId: 1, classSubjectId: 1, createdAt: -1 });
DiscussionPostSchema.index({ classSubjectId: 1, isActive: 1, createdAt: -1 });
DiscussionPostSchema.index({ classSubjectId: 1, category: 1, isActive: 1, createdAt: -1 });
