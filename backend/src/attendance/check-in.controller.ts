import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { requireWorkspace } from './attendance-access';
import { CheckInService } from './check-in.service';
import { CheckInDto } from './dto/check-in.dto';
import { MyAttendanceService } from './my-attendance.service';

/**
 * Web self check-in (ATT-04, ATT-06, ATT-11) and "My attendance" (ATT-18) for students and teachers of
 * the workspace: today's classes with their window, the check-in itself, and the month calendar. Errors carry a `code` (ATTENDANCE_CHECKIN_*)
 * and, where useful, `details` (opens_at, distance_m and radius_m, accuracy_m). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance', version: '1' })
export class CheckInController {
  constructor(
    private readonly checkIns: CheckInService,
    private readonly myAttendance: MyAttendanceService,
  ) {}

  @Get('me/today')
  @ApiOperation({ summary: "Today's classes of the caller (as a student, or as their teacher) with the check-in window and their own record" })
  async today(@UserPayload() user: JwtPayloadInterface) {
    return { message: "Today's classes retrieved successfully", payload: await this.checkIns.today(requireWorkspace(), user.id) };
  }

  @Get('me/calendar')
  @ApiOperation({ summary: "The caller's own classes in a month (ATT-18) with their status, the counts and the attendance %" })
  @ApiQuery({ name: 'month', required: false, example: '2026-11', description: "YYYY-MM; default: this month in the organisation's time zone" })
  async calendar(@Query('month') month: string | undefined, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Attendance retrieved successfully', payload: await this.myAttendance.calendar(requireWorkspace(), user.id, month || undefined) };
  }

  @Post('check-in')
  @HttpCode(200)
  @ApiOperation({
    summary: "Check in to one of today's classes",
    description:
      'Open from 15 minutes before the start to the end. In-person classes need latitude, longitude and accuracy_m (100 m or better) within the branch radius; online classes take none. Late after the start + grace period. One check-in per class.',
  })
  async checkIn(@Body() dto: CheckInDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Checked in', payload: await this.checkIns.checkIn(requireWorkspace(), user.id, dto) };
  }
}
