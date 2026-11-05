import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { HolidayEntity } from './entities/holiday.entity';
import { RoutineSlotEntity } from './entities/routine-slot.entity';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { RoutineSlotsService } from './routine-slots.service';

/** Calendar (Epic 9, design §4). So far: holidays and closures (CAL-04) and section schedules as routine slots (ATT-16); the routine screens and events come in P5. */
@Module({
  imports: [TypeOrmModule.forFeature([HolidayEntity, RoutineSlotEntity]), OrganizationsModule, SubscriptionModule],
  controllers: [HolidaysController],
  providers: [HolidaysService, RoutineSlotsService],
  exports: [HolidaysService, RoutineSlotsService],
})
export class CalendarModule {}
