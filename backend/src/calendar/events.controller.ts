import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CancelEventDto, CreateEventDto, EventsQueryDto, UpdateEventDto } from './dto/event.dto';
import { EventsService } from './events.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/**
 * Calendar events (CAL-03, CAL-06): exams, meetings, parent meetings and activities with their
 * attendees. Staff add events; everyone sees the ones they attend. Errors carry a `code` (EVENT_*).
 * Needs `calendar`.
 */
@ApiTags('Events')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CALENDAR)
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Events the caller may see from `from` to `to` (school dates, at most 62 days), by start' })
  async list(@Query() query: EventsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Events retrieved successfully', payload: await this.events.list(workspace(), user.id, query.from, query.to) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One event the caller may see' })
  async get(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Event retrieved successfully', payload: await this.events.get(workspace(), user.id, id) };
  }

  @Post()
  @ApiOperation({ summary: 'Add an event (staff); attendees are told in-app' })
  async create(@Body() dto: CreateEventDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Event added', payload: await this.events.create(workspace(), { id: user.id, full_name: user.full_name }, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change an event (who made it, or owners, admins, assistants); within 48 hours attendees are told' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Event changed', payload: await this.events.update(workspace(), { id: user.id, full_name: user.full_name }, id, dto) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel an event (kept); within 48 hours attendees are told' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelEventDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Event cancelled', payload: await this.events.cancel(workspace(), { id: user.id }, id, dto) };
  }
}
