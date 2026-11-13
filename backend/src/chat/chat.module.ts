import { Module } from '@nestjs/common';
import { AcademicsModule } from 'src/academics/academics.module';
import { ChatMongoModule } from 'src/chat-mongo/chat-mongo.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { ChatBroadcaster } from './chat-broadcaster';
import { ChatGroupsService } from './chat-groups.service';
import { ChatMessagesService } from './chat-messages.service';
import { ChatController } from './chat.controller';
import { ChatDirectController } from './chat-direct.controller';
import { ChatDirectService } from './chat-direct.service';
import { ChatGateway } from './chat.gateway';

/**
 * Chat (Epic 7, design §4): owns the MongoDB chat collections group_chats, group_messages,
 * chat_member_states (P9-01) and direct_chats (P9-02). Subject classes and their members come from academics.
 */
@Module({
  imports: [ChatMongoModule, AcademicsModule, OrganizationsModule, NotificationsModule, SubscriptionModule],
  controllers: [ChatController, ChatDirectController],
  providers: [ChatGroupsService, ChatDirectService, ChatMessagesService, ChatGateway, ChatBroadcaster],
  exports: [ChatGroupsService],
})
export class ChatModule {}
