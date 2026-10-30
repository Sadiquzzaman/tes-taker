import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/email/email.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { QueueModule } from 'src/queue/queue.module';
import { SmsModule } from 'src/sms/sms.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { MessageTemplateEntity } from './entities/message-template.entity';
import { NotificationOutboxEntity } from './entities/notification-outbox.entity';
import { SmsCreditLedgerEntity } from './entities/sms-credit-ledger.entity';
import { MessageLogService } from './message-log.service';
import { MessageTemplatesService } from './message-templates.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsCreditsController } from './sms-credits.controller';
import { SmsCreditsService } from './sms-credits.service';

/**
 * Notifications (design §8.6): the outbox, templates, the dispatcher the worker runs, the message
 * log and SMS credits (FND-13). Global, so any module can inject NotificationsService to queue a message without
 * importing this module (SMS and organisations are both used here and senders themselves).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationOutboxEntity, MessageTemplateEntity, SmsCreditLedgerEntity]),
    QueueModule,
    SmsModule,
    EmailModule,
    // EntitlementsService: the plan's monthly SMS allowance.
    SubscriptionModule,
    // OrganizationContextGuard for the message log.
    OrganizationsModule,
  ],
  controllers: [NotificationsController, SmsCreditsController],
  providers: [NotificationsService, MessageTemplatesService, NotificationDispatcherService, MessageLogService, SmsCreditsService],
  exports: [NotificationsService, NotificationDispatcherService, SmsCreditsService],
})
export class NotificationsModule {}
