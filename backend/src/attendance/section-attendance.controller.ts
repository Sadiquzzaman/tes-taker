import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { requireWorkspace } from './attendance-access';
import { CancelClassDto, CorrectRecordDto, SessionsQueryDto } from './dto/correction.dto';
import { SectionAttendanceService } from './section-attendance.service';

/**
 * Class attendance for staff (ATT-07, ATT-12, ATT-11): the classes of a date with who checked in,
 * one class's list, and corrections with a reason (kept with their trail and in the audit log).
 * Owners, admins and assistants see every class; a teacher the classes they teach, and cancels or
 * restores them for a day (ATT-19). Errors carry a `code` (ATTENDANCE_SESSION_*,
 * ATTENDANCE_CORRECTION_*, ATTENDANCE_CANCEL_*). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/sessions', version: '1' })
export class SectionAttendanceController {
  constructor(private readonly attendance: SectionAttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'The classes on a date (default today) the caller may see, with counts' })
  async list(@Query() query: SessionsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Classes retrieved successfully', payload: await this.attendance.list(requireWorkspace(), user.id, query.date) };
  }

  @Get(':slotId/:date')
  @ApiOperation({ summary: "One class on a date: every student's and teacher's status, check-in and corrections" })
  async detail(@Param('slotId', ParseUUIDPipe) slotId: string, @Param('date') date: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Class attendance retrieved successfully', payload: await this.attendance.detail(requireWorkspace(), user.id, slotId, date) };
  }

  @Put(':slotId/:date/records/:personId')
  @ApiOperation({
    summary: "Correct a person's status in a class (with a reason)",
    description: 'PRESENT, LATE (optional late_minutes) or ABSENT, once the class has started. Teachers correct students only. Returns the class.',
  })
  async correct(
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Param('date') date: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: CorrectRecordDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Attendance corrected', payload: await this.attendance.correct(requireWorkspace(), user.id, slotId, date, personId, dto) };
  }

  @Post(':slotId/:date/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel a class for one day (with an optional note); students are told in-app',
    description: 'Today or up to 60 days ahead, before the class ends, on a school day. Nobody is marked Absent. Returns the class.',
  })
  async cancel(
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Param('date') date: string,
    @Body() dto: CancelClassDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Class cancelled', payload: await this.attendance.cancel(requireWorkspace(), user.id, slotId, date, dto) };
  }

  @Post(':slotId/:date/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a cancelled class (before it ends); students are told in-app' })
  async restore(@Param('slotId', ParseUUIDPipe) slotId: string, @Param('date') date: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Class restored', payload: await this.attendance.restore(requireWorkspace(), user.id, slotId, date) };
  }
}
