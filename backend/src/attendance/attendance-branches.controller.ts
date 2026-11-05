import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ATTENDANCE_MANAGERS, ATTENDANCE_STAFF, requireAttendanceRole } from './attendance-access';
import { AttendanceBranchesService } from './attendance-branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

const CHANGE_DENIED = 'Only owners and admins can change branches';

/**
 * Branches of the current workspace with their check-in pin and radius (ATT-15). The list always
 * holds the main (default) branch, which carries the organisation's own pin. Needs `attendance`.
 */
@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE)
@Controller({ path: 'attendance/branches', version: '1' })
export class AttendanceBranchesController {
  constructor(private readonly branches: AttendanceBranchesService) {}

  @Get()
  @ApiOperation({ summary: 'Branches, the main branch first (staff of the workspace)' })
  async list() {
    const tenant = requireAttendanceRole(ATTENDANCE_STAFF, 'Only staff can see the branches');
    return { message: 'Branches retrieved successfully', payload: await this.branches.list(tenant.organizationId) };
  }

  @Post()
  @ApiOperation({ summary: 'Add a branch (Owner/Admin; not in a solo workspace). Errors carry a `code` (ATTENDANCE_BRANCH*)' })
  async create(@Body() dto: CreateBranchDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_MANAGERS, CHANGE_DENIED);
    return { message: 'Branch added', payload: await this.branches.create(tenant, user.id, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a branch: name, address, pin or radius (Owner/Admin)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_MANAGERS, CHANGE_DENIED);
    return { message: 'Branch updated', payload: await this.branches.update(tenant, user.id, id, dto) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a branch no section of an open session uses (Owner/Admin); the record is kept' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    const tenant = requireAttendanceRole(ATTENDANCE_MANAGERS, CHANGE_DENIED);
    await this.branches.remove(tenant, user.id, id);
    return { message: 'Branch removed', payload: null };
  }
}
