import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CreateHolidayDto, ListHolidaysQueryDto, UpdateHolidayDto } from './dto/holiday.dto';
import { HolidaysService } from './holidays.service';

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

/**
 * Holidays and closures of the current workspace (CAL-04). Either `attendance` or `calendar` opens
 * it (owner decision, P3-01): closed days matter to both.
 */
@ApiTags('Holidays')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.ATTENDANCE, FeatureKey.CALENDAR)
@Controller({ path: 'holidays', version: '1' })
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Holidays in force, optionally those overlapping from–to (everyone in the workspace)' })
  async list(@Query() query: ListHolidaysQueryDto) {
    TenantContext.requireOrganizationId();
    const payload = await this.holidays.list(query);
    return { message: 'Holidays retrieved successfully', payload };
  }

  @Post()
  @ApiOperation({ summary: 'Add a holiday or closure (Owner/Admin); today or later only. Errors carry a `code` (HOLIDAY_*)' })
  async create(@Body() dto: CreateHolidayDto, @UserPayload() user: JwtPayloadInterface) {
    requireManager();
    const payload = await this.holidays.create(dto, user);
    return { message: 'Holiday added', payload };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a holiday that has not started yet (Owner/Admin)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHolidayDto, @UserPayload() user: JwtPayloadInterface) {
    requireManager();
    const payload = await this.holidays.update(id, dto, user);
    return { message: 'Holiday updated', payload };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a holiday that has not started yet (Owner/Admin); the record is kept' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    requireManager();
    await this.holidays.remove(id, user);
    return { message: 'Holiday removed', payload: null };
  }
}

function requireManager(): void {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  if (tenant.viaEnrolment || !MANAGERS.includes(tenant.memberRole)) {
    throw new ForbiddenException('Only owners and admins can change holidays');
  }
}
