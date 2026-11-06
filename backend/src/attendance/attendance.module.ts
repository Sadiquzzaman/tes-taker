import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { CalendarModule } from 'src/calendar/calendar.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { AttendanceBranchesController } from './attendance-branches.controller';
import { AttendanceAlertsService } from './attendance-alerts.service';
import { ApprovedLeaveService } from './approved-leave.service';
import { AttendanceClock } from './attendance-clock';
import { AttendanceBranchesService } from './attendance-branches.service';
import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsService } from './attendance-settings.service';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';
import { ClassSessionsService } from './class-sessions.service';
import { MyAttendanceService } from './my-attendance.service';
import { SectionAttendanceController } from './section-attendance.controller';
import { SectionAttendanceService } from './section-attendance.service';
import { AttendanceCorrectionEntity } from './entities/attendance-correction.entity';
import { AttendanceRecordEntity } from './entities/attendance-record.entity';
import { ClassSessionEntity } from './entities/class-session.entity';
import { LeaveRequestEntity } from './entities/leave-request.entity';
import { SectionAttendanceSettingsEntity } from './entities/section-attendance-settings.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { ScheduleImportService } from './schedule-import.service';
import { SectionSetupController } from './section-setup.controller';
import { SectionSetupService } from './section-setup.service';
import { SessionClosingService } from './session-closing.service';

/**
 * Attendance (Epic 1, design §4). So far: the settings (ATT-01, in org_settings), branches (ATT-15),
 * section setup with schedules (ATT-16) and class sessions with web self check-in (ATT-04, 06, 11)
 * "My attendance" (ATT-18), the teachers' class view with corrections (ATT-07, ATT-12) and class
 * cancellation (ATT-19), the closing job that saves Absent when check-in closes (ATT-10), and the
 * guardians' Late and Absent SMS and the repeated-absence alert (ATT-06, ATT-10, ATT-14), and leave
 * requests with their approvals (ATT-09, ATT-11).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SectionAttendanceSettingsEntity, ClassSessionEntity, AttendanceRecordEntity, AttendanceCorrectionEntity, LeaveRequestEntity, OrganizationMemberEntity]), OrganizationsModule, AcademicsModule, CalendarModule, SubscriptionModule, NotificationsModule],
  controllers: [AttendanceSettingsController, AttendanceBranchesController, SectionSetupController, CheckInController, SectionAttendanceController, LeaveController],
  providers: [
    AttendanceSettingsService,
    AttendanceBranchesService,
    SectionSetupService,
    ScheduleImportService,
    AttendanceClock,
    ClassSessionsService,
    CheckInService,
    MyAttendanceService,
    SectionAttendanceService,
    SessionClosingService,
    AttendanceAlertsService,
    ApprovedLeaveService,
    LeaveService,
  ],
  exports: [AttendanceSettingsService, SessionClosingService, AttendanceAlertsService],
})
export class AttendanceModule {}
