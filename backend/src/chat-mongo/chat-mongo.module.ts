import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoChatHealthService } from './mongo-chat-health.service';
import { DiscussionComment, DiscussionCommentSchema } from './schemas/discussion-comment.schema';
import { DiscussionPost, DiscussionPostSchema } from './schemas/discussion-post.schema';
import {
  PrivateConversation,
  PrivateConversationSchema,
} from './schemas/private-conversation.schema';
import { PrivateMessage, PrivateMessageSchema } from './schemas/private-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiscussionPost.name, schema: DiscussionPostSchema },
      { name: DiscussionComment.name, schema: DiscussionCommentSchema },
      { name: PrivateConversation.name, schema: PrivateConversationSchema },
      { name: PrivateMessage.name, schema: PrivateMessageSchema },
    ]),
  ],
  providers: [MongoChatHealthService],
  exports: [MongooseModule, MongoChatHealthService],
})
export class ChatMongoModule {}
