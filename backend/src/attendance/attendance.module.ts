import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { AttendanceBranchesController } from './attendance-branches.controller';
import { AttendanceClock } from './attendance-clock';
import { AttendanceBranchesService } from './attendance-branches.service';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { ClassSessionsService } from './class-sessions.service';
import { MyAttendanceService } from './my-attendance.service';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import { AttendanceRecordEntity } from './entities/attendance-record.entity';
import { ClassSessionEntity } from './entities/class-session.entity';
import { SectionAttendanceSettingsEntity } from './entities/section-attendance-settings.entity';
import { ScheduleImportService } from './schedule-import.service';
import { SectionSetupController } from './section-setup.controller';
import { SectionSetupService } from './section-setup.service';

/**
 * Attendance (Epic 1, design §4). So far: the settings (ATT-01, in org_settings), branches (ATT-15),
 * section setup with schedules (ATT-16) and class sessions with web self check-in (ATT-04, 06, 11)
 * and "My attendance" (ATT-18).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SectionAttendanceSettingsEntity, ClassSessionEntity, AttendanceRecordEntity, AttendanceCorrectionEntity]), OrganizationsModule, AcademicsModule, CalendarModule, SubscriptionModule],
  controllers: [AttendanceSettingsController, AttendanceBranchesController, SectionSetupController, CheckInController],
  providers: [
    AttendanceSettingsService,
    AttendanceBranchesService,
    SectionSetupService,
    ScheduleImportService,
    AttendanceClock,
    ClassSessionsService,
    CheckInService,
    MyAttendanceService,
  ],
  exports: [AttendanceSettingsService],
})
export class AttendanceModule {}
