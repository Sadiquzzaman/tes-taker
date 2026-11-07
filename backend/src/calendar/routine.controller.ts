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
import { RoutineQueryDto, RoutineSlotInputDto, UpdateRoutineSlotDto } from './dto/routine.dto';
import { RoutineService } from './routine.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/**
 * The weekly class routine (CAL-01, CAL-02): staff read a session's routine; owners, admins and
 * assistants add, change and remove slots, confirming teacher or room clashes; everyone sees their
 * own routine. Errors carry a `code` (ROUTINE_*, SCHEDULE_*). Needs `calendar`.
 */
@ApiTags('Routine')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CALENDAR)
@Controller({ path: 'routine', version: '1' })
export class RoutineController {
  constructor(private readonly routine: RoutineService) {}

  @Get()
  @ApiOperation({ summary: "A session's weekly routine with its sections, subject classes, rooms and clashes (staff)" })
  async get(@Query() query: RoutineQueryDto) {
    return { message: 'Routine retrieved successfully', payload: await this.routine.routine(workspace(), query.session_id) };
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
