import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ATTENDANCE_MANAGERS, requireAttendanceRole, requireWorkspace } from './attendance-access';
import { AttendanceReportsService } from './attendance-reports.service';
import { RegisterMonthQueryDto } from './dto/paper-register.dto';
import { DailyReportQueryDto, TeacherReportQueryDto } from './dto/report.dto';

/**
 * Attendance reports (ATT-13): the daily summary per section, the monthly register with each
 * student's totals and attendance %, and the teacher report (ATT-11). Sections as on the class view
 * (owners, admins and assistants every section; a teacher the sections they teach); the teacher
 * report is for owners and admins only. Students see their own attendance on "My attendance".
 * Errors carry a `code` (ATTENDANCE_REPORT_*, ATTENDANCE_REGISTER_*). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/reports', version: '1' })
export class AttendanceReportsController {
  constructor(private readonly reports: AttendanceReportsService) {}

  @Get('daily')
  @ApiOperation({
    summary: 'The daily summary per section: each class, and each student as present, late, absent or on leave that day',
    description: 'Absent = missed every class held that day; `missed` counts the classes missed by someone who attended others.',
  })
  async daily(@Query() query: DailyReportQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Daily summary retrieved successfully', payload: await this.reports.daily(requireWorkspace(), user.id, query.date, query.section_id) };
  }

  @Get('sections/:id/month')
  @ApiOperation({ summary: "A section's monthly register: the class grid (as the register CSV), each student's day marks, counts and attendance %" })
  async month(@Param('id', ParseUUIDPipe) id: string, @Query() query: RegisterMonthQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Monthly register retrieved successfully', payload: await this.reports.month(requireWorkspace(), user.id, id, query.month) };
  }

  @Get('teachers')
  @ApiOperation({ summary: "Teachers' attendance from a date to a date (at most 31 days): counts, %, minutes late and the classes not on time. Owners and admins." })
  async teachers(@Query() query: TeacherReportQueryDto) {
    const tenant = requireAttendanceRole(ATTENDANCE_MANAGERS, 'Only owners and admins see the teacher report');
    return { message: 'Teacher report retrieved successfully', payload: await this.reports.teachers(tenant, query.from, query.to) };
  }
}
