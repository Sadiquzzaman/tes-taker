import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { AttendanceSettingsService } from './attendance-settings.service';
import { UpdateAttendanceSettingsDto } from './dto/update-attendance-settings.dto';

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];
const STAFF = [...MANAGERS, OrganizationMemberRoleEnum.ASSISTANT, OrganizationMemberRoleEnum.TEACHER];

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
    const payload = await this.settings.get(requireTenant(STAFF, 'Only staff can see the attendance settings').organizationId);
    return { message: 'Attendance settings retrieved successfully', payload };
  }

  @Patch()
  @ApiOperation({
    summary: 'Change attendance settings (Owner/Admin)',
    description:
      'Errors carry a `code` (ATTENDANCE_*). Switching the daily presence method while a session is running needs `confirm_method_change: true`; saved records are kept.',
  })
  async update(@Body() dto: UpdateAttendanceSettingsDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireTenant(MANAGERS, 'Only owners and admins can change the attendance settings');
    const payload = await this.settings.update(tenant, user.id, dto);
    return { message: 'Attendance settings saved successfully', payload };
  }
}

/** Members with one of these roles (a solo teacher is OWNER of their own workspace). */
function requireTenant(roles: OrganizationMemberRoleEnum[], message: string): Tenant {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  if (tenant.viaEnrolment || !roles.includes(tenant.memberRole)) throw new ForbiddenException(message);
  return tenant;
}
