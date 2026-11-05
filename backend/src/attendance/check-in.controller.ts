import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { requireWorkspace } from './attendance-access';
import { CheckInService } from './check-in.service';
import { CheckInDto } from './dto/check-in.dto';

/**
 * Web self check-in (ATT-04, ATT-06, ATT-11) for students and teachers of the workspace: today's
 * classes with their window, and the check-in itself. Errors carry a `code` (ATTENDANCE_CHECKIN_*)
 * and, where useful, `details` (opens_at, distance_m and radius_m, accuracy_m). Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance', version: '1' })
export class CheckInController {
  constructor(private readonly checkIns: CheckInService) {}

  @Get('me/today')
  @ApiOperation({ summary: "Today's classes of the caller (as a student, or as their teacher) with the check-in window and their own record" })
  async today(@UserPayload() user: JwtPayloadInterface) {
    return { message: "Today's classes retrieved successfully", payload: await this.checkIns.today(requireWorkspace(), user.id) };
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
