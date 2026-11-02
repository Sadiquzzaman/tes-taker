import { Module } from '@nestjs/common';
import { AcademicsModule } from 'src/academics/academics.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';

/** Attendance (Epic 1, design §4). So far: the settings (ATT-01), stored in org_settings. */
@Module({
  imports: [OrganizationsModule, AcademicsModule, SubscriptionModule],
  controllers: [AttendanceSettingsController],
  providers: [AttendanceSettingsService],
  exports: [AttendanceSettingsService],
})
export class AttendanceModule {}
