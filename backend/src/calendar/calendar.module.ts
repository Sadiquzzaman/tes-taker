import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { HolidayEntity } from './entities/holiday.entity';
import { RoutineSlotEntity } from './entities/routine-slot.entity';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { RoutineSlotsService } from './routine-slots.service';
import { RoutineController } from './routine.controller';
import { RoutineService } from './routine.service';

/**
 * Calendar (Epic 9, design §4). So far: holidays and closures (CAL-04), section schedules as
 * routine slots (ATT-16), and the weekly routine with subjects, teachers, rooms and clash warnings
 * (CAL-01, CAL-02). Events and reminders come next in P5.
 */
@Module({
  imports: [TypeOrmModule.forFeature([HolidayEntity, RoutineSlotEntity, OrganizationMemberEntity]), OrganizationsModule, SubscriptionModule, AcademicsModule],
  controllers: [HolidaysController, RoutineController],
  providers: [HolidaysService, RoutineSlotsService, RoutineService],
  exports: [HolidaysService, RoutineSlotsService],
})
export class CalendarModule {}
