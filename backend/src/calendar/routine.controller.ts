import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CopyRoutineDto, RoutineQueryDto, RoutineSlotInputDto, RoutineSlotsInputDto, UpdateRoutineSlotDto } from './dto/routine.dto';
import { RoutineService } from './routine.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/**
 * The weekly class routine (CAL-01, CAL-02), the one place the timetable is edited: staff read
 * every section, students their own; owners, admins and staff change every section and teachers the
 * sections they teach — one period on one or several days, a copied week — confirming teacher or
 * room clashes. Errors carry a `code` (ROUTINE_*, SCHEDULE_*). Needs `calendar` or `attendance`.
 */
@ApiTags('Routine')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CALENDAR, FeatureKey.ATTENDANCE)
@Controller({ path: 'routine', version: '1' })
export class RoutineController {
  constructor(private readonly routine: RoutineService) {}

  @Get()
  @ApiOperation({ summary: "A session's weekly routine: every section for staff, their own for students; which sections the caller may edit" })
  async get(@Query() query: RoutineQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Routine retrieved successfully', payload: await this.routine.routine(workspace(), user.id, query.session_id) };
  }

  @Get('mine')
  @ApiOperation({ summary: "The caller's own weekly routine in open sessions (students: their sections; teachers: their classes)" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Routine retrieved successfully', payload: await this.routine.mine(workspace(), user.id) };
  }

  @Post('slots')
  @ApiOperation({ summary: 'Add a weekly slot (owners, admins, assistants); 409 ROUTINE_CLASH unless confirm_clashes' })
  async add(@Body() dto: RoutineSlotInputDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Slot added', payload: await this.routine.add(workspace(), user.id, dto) };
  }

  @Post('slots/many')
  @ApiOperation({ summary: 'Add the same period on several days; 409 ROUTINE_CLASH (every day\'s clashes) unless confirm_clashes' })
  async addMany(@Body() dto: RoutineSlotsInputDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Slots added', payload: await this.routine.addMany(workspace(), user.id, dto) };
  }

  @Post('sections/:id/copy')
  @HttpCode(200)
  @ApiOperation({ summary: "Replace this section's week with another section's (subjects matched, teachers when clear, no rooms)" })
  async copy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CopyRoutineDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Routine copied', payload: await this.routine.copyWeek(workspace(), user.id, id, dto.from_section_id) };
  }

  @Patch('slots/:id')
  @ApiOperation({ summary: 'Change a weekly slot; a new day or time gives it a new id (the old row is kept)' })
  async change(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoutineSlotDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Slot changed', payload: await this.routine.change(workspace(), user.id, id, dto) };
  }

  @Delete('slots/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a weekly slot from the routine (the row is kept for attendance history)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.routine.remove(workspace(), user.id, id);
    return { message: 'Slot removed', payload: null };
  }
}
