import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ATTENDANCE_MANAGERS, ATTENDANCE_STAFF, requireAttendanceRole } from './attendance-access';
import { AttendanceSettingsService } from './attendance-settings.service';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

/** The current workspace's attendance settings (ATT-01). Needs the `attendance` feature (design §8.3). */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/settings', version: '1' })
export class AttendanceSettingsController {
  constructor(private readonly settings: AttendanceSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Attendance settings (staff of the workspace)' })
  async get() {
    const payload = await this.settings.get(requireAttendanceRole(ATTENDANCE_STAFF, 'Only staff can see the attendance settings').organizationId);
    return { message: 'Attendance settings retrieved successfully', payload };
  }

  @Patch()
  @ApiOperation({
    summary: 'Change attendance settings (Owner/Admin)',
    description: 'Grace period, weekly off days, guardian SMS and the repeated-absence alert. Class times come from section schedules; the pin and radius from branches.',
  })
  async update(@Body() dto: UpdateAttendanceSettingsDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_MANAGERS, 'Only owners and admins can change the attendance settings');
    const payload = await this.settings.update(tenant, user.id, dto);
    return { message: 'Attendance settings saved successfully', payload };
  }
}
