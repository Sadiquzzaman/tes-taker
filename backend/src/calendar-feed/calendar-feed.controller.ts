import { Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CalendarFeedService } from './calendar-feed.service';
import { CalendarFeedQueryDto } from './dto/feed.dto';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/** The person's calendar (CAL-07) and their private subscription link. Needs `calendar`. */
@ApiTags('Calendar')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CALENDAR)
@Controller({ path: 'calendar', version: '1' })
export class CalendarFeedController {
  constructor(private readonly feed: CalendarFeedService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Classes (with day changes), events, exams and closed days from `from` to `to`, at most 62 days' })
  async get(@Query() query: CalendarFeedQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar retrieved successfully', payload: await this.feed.feed(workspace(), user.id, query.from, query.to) };
  }

  @Get('ical-link')
  @ApiOperation({ summary: 'Whether the caller has a calendar subscription link' })
  async link(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar link retrieved successfully', payload: await this.feed.linkStatus(workspace(), user.id) };
  }

  @Post('ical-link')
  @ApiOperation({ summary: 'Make a new private subscription link (the old one stops working); its path is shown once' })
  async newLink(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar link made', payload: await this.feed.newLink(workspace(), user.id) };
  }

  @Delete('ical-link')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn the subscription link off' })
  async revoke(@UserPayload() user: JwtPayloadInterface) {
    await this.feed.revoke(workspace(), user.id);
    return { message: 'Calendar link turned off', payload: null };
  }
}

/**
 * The person's own calendar across all their workspaces (schools, their teaching workspace, solo
 * teachers' classes): no workspace needs to be chosen. Each workspace without the calendar is left out.
 */
@ApiTags('Calendar')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'calendar/me', version: '1' })
export class CalendarPersonalController {
  constructor(private readonly feed: CalendarFeedService) {}

  @Get()
  @ApiOperation({ summary: "The caller's classes, events, exams, homework and closed days in every workspace, from `from` to `to` (at most 62 days)" })
  async get(@Query() query: CalendarFeedQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar retrieved successfully', payload: await this.feed.personal(user.id, query.from, query.to) };
  }

  @Get('ical-link')
  @ApiOperation({ summary: 'Whether the caller has a personal subscription link (all their workspaces in one calendar)' })
  async link(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar link retrieved successfully', payload: await this.feed.linkStatus(null, user.id) };
  }

  @Post('ical-link')
  @ApiOperation({ summary: 'Make a new personal subscription link for all workspaces (the old one stops working); its path is shown once' })
  async newLink(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Calendar link made', payload: await this.feed.newLink(null, user.id) };
  }

  @Delete('ical-link')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn the personal subscription link off' })
  async revoke(@UserPayload() user: JwtPayloadInterface) {
    await this.feed.revoke(null, user.id);
    return { message: 'Calendar link turned off', payload: null };
  }
}

/**
 * The private subscription link itself (CAL-07): Google or Apple Calendar reads it without
 * signing in; the token in the path is the key. Text/calendar.
 */
@ApiTags('Calendar')
@Controller({ path: 'calendar/ical', version: '1' })
export class CalendarIcalController {
  constructor(private readonly feed: CalendarFeedService) {}

  @Get(':token')
  @ApiOperation({ summary: "A person's calendar as iCal (30 days back, 90 ahead), for Google or Apple Calendar" })
  async ical(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const text = await this.feed.ical(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=900');
    res.send(text);
  }
}
