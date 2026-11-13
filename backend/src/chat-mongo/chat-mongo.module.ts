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
import { GroupChat, GroupChatSchema } from './schemas/group-chat.schema';
import { GroupMessage, GroupMessageSchema } from './schemas/group-message.schema';
import { ChatMemberState, ChatMemberStateSchema } from './schemas/chat-member-state.schema';
import { DirectChat, DirectChatSchema } from './schemas/direct-chat.schema';
import { ChatUserMute, ChatUserMuteSchema } from './schemas/chat-user-mute.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiscussionPost.name, schema: DiscussionPostSchema },
      { name: DiscussionComment.name, schema: DiscussionCommentSchema },
      { name: PrivateConversation.name, schema: PrivateConversationSchema },
      { name: PrivateMessage.name, schema: PrivateMessageSchema },
      { name: GroupChat.name, schema: GroupChatSchema },
      { name: GroupMessage.name, schema: GroupMessageSchema },
      { name: ChatMemberState.name, schema: ChatMemberStateSchema },
      { name: DirectChat.name, schema: DirectChatSchema },
      { name: ChatUserMute.name, schema: ChatUserMuteSchema },
    ]),
  ],
  providers: [MongoChatHealthService],
  exports: [MongooseModule, MongoChatHealthService],
})
export class ChatMongoModule {}
