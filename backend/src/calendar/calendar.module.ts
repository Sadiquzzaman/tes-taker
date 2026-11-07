import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { EventAttendeeEntity } from './entities/event-attendee.entity';
import { EventEntity } from './entities/event.entity';
import { HolidayEntity } from './entities/holiday.entity';
import { RoutineSlotEntity } from './entities/routine-slot.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { RoutineSlotsService } from './routine-slots.service';
import { RoutineController } from './routine.controller';
import { RoutineService } from './routine.service';

/**
 * Calendar (Epic 9, design §4). So far: holidays and closures (CAL-04), section schedules as
 * routine slots (ATT-16), and the weekly routine with subjects, teachers, rooms and clash warnings
 * (CAL-01, CAL-02), and events with attendees and change notices (CAL-03, CAL-06). Reminders come next.
 */
@Module({
  imports: [TypeOrmModule.forFeature([HolidayEntity, RoutineSlotEntity, EventEntity, EventAttendeeEntity, OrganizationMemberEntity]), OrganizationsModule, SubscriptionModule, AcademicsModule, NotificationsModule],
  controllers: [HolidaysController, RoutineController, EventsController],
  providers: [HolidaysService, RoutineSlotsService, RoutineService, EventsService],
  exports: [HolidaysService, RoutineSlotsService, RoutineService, EventsService],
})
export class CalendarModule {}
