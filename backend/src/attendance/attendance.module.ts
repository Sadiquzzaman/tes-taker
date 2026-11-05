import { Module } from '@nestjs/common';
import { AcademicsModule } from 'src/academics/academics.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { AttendanceBranchesController } from './attendance-branches.controller';
import { AttendanceBranchesService } from './attendance-branches.service';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';

/** Attendance (Epic 1, design §4). So far: the settings (ATT-01, in org_settings) and branches (ATT-15). */
@Module({
  imports: [OrganizationsModule, AcademicsModule, SubscriptionModule],
  controllers: [AttendanceSettingsController, AttendanceBranchesController],
  providers: [AttendanceSettingsService, AttendanceBranchesService],
  exports: [AttendanceSettingsService],
})
export class AttendanceModule {}
