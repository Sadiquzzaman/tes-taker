import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { HolidayEntity } from './entities/holiday.entity';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';

/** Calendar (Epic 9, design §4). So far: holidays and closures (CAL-04); routine and events come in P5. */
@Module({
  imports: [TypeOrmModule.forFeature([HolidayEntity]), OrganizationsModule, SubscriptionModule],
  controllers: [HolidaysController],
  providers: [HolidaysService],
  exports: [HolidaysService],
})
export class CalendarModule {}
