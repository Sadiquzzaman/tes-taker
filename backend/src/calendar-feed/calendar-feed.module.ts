import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { ExamModule } from 'src/exams/exam.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { CalendarFeedController, CalendarIcalController } from './calendar-feed.controller';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedTokenEntity } from './entities/calendar-feed-token.entity';

/**
 * The person's calendar (CAL-07, design §9.9): reads classes from attendance (My attendance, with
 * day changes), the routine and events from calendar, and exams from exams, through their
 * services; owns only `calendar_feed_tokens`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CalendarFeedTokenEntity, OrganizationMemberEntity]), AttendanceModule, CalendarModule, ExamModule, OrganizationsModule, SubscriptionModule],
  controllers: [CalendarFeedController, CalendarIcalController],
  providers: [CalendarFeedService],
})
export class CalendarFeedModule {}
