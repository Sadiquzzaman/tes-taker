import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { ExamModule } from 'src/exams/exam.module';
import { HomeworkModule } from 'src/homework/homework.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { CalendarFeedController, CalendarIcalController, CalendarPersonalController } from './calendar-feed.controller';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedTokenEntity } from './entities/calendar-feed-token.entity';
import { ReminderRuleEntity } from './entities/reminder-rule.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

/**
 * The person's calendar (CAL-07, design §9.9): reads classes from attendance (My attendance, with
 * day changes), the routine and events from calendar, exams from exams and homework due dates
 * from homework, through their services, in one workspace or across all of the person's; owns `calendar_feed_tokens` and `reminder_rules` (reminders before classes, exams and
 * events, CAL-05; the worker's calendar.reminders job sends them).
 */
@Module({
  imports: [TypeOrmModule.forFeature([CalendarFeedTokenEntity, ReminderRuleEntity, OrganizationMemberEntity]), AttendanceModule, CalendarModule, ExamModule, HomeworkModule, NotificationsModule, OrganizationsModule, SubscriptionModule],
  controllers: [CalendarFeedController, CalendarPersonalController, CalendarIcalController, RemindersController],
  providers: [CalendarFeedService, RemindersService],
  exports: [RemindersService],
})
export class CalendarFeedModule {}
