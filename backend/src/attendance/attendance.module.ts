import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { AttendanceBranchesController } from './attendance-branches.controller';
import { AttendanceBranchesService } from './attendance-branches.service';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';
import { SectionAttendanceSettingsEntity } from './entities/section-attendance-settings.entity';
import { ScheduleImportService } from './schedule-import.service';
import { SectionSetupController } from './section-setup.controller';
import { SectionSetupService } from './section-setup.service';

/** Attendance (Epic 1, design §4). So far: the settings (ATT-01, in org_settings), branches (ATT-15) and section setup with schedules (ATT-16). */
@Module({
  imports: [TypeOrmModule.forFeature([SectionAttendanceSettingsEntity]), OrganizationsModule, AcademicsModule, CalendarModule, SubscriptionModule],
  controllers: [AttendanceSettingsController, AttendanceBranchesController, SectionSetupController],
  providers: [AttendanceSettingsService, AttendanceBranchesService, SectionSetupService, ScheduleImportService],
  exports: [AttendanceSettingsService],
})
export class AttendanceModule {}
