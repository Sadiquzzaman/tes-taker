import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseEnumPipe, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { SaveRemindersDto } from './dto/reminder.dto';
import { ReminderTargetEnum } from './entities/reminder-rule.entity';
import { RemindersService } from './reminders.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/**
 * Reminders before classes, exams and events (CAL-05): the organisation's defaults (owners and
 * admins) and each person's own. Errors carry a `code` (REMINDER_INVALID). Needs `calendar`.
 */
@ApiTags('Reminders')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CALENDAR)
@Controller({ path: 'reminders', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  @ApiOperation({ summary: "The organisation's default reminders and the caller's own, per kind (class, exam, event)" })
  async get(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Reminders retrieved successfully', payload: await this.reminders.settings(workspace(), user.id) };
  }

  @Put('defaults/:target')
  @ApiOperation({ summary: "Set the organisation's default reminders for a kind (owners and admins)" })
  async saveDefaults(@Param('target', new ParseEnumPipe(ReminderTargetEnum)) target: ReminderTargetEnum, @Body() dto: SaveRemindersDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Reminders saved', payload: await this.reminders.saveDefaults(workspace(), user.id, target, dto.offsets) };
  }

  @Put('mine/:target')
  @ApiOperation({ summary: 'Set your own reminders for a kind; an empty list switches them off' })
  async saveMine(@Param('target', new ParseEnumPipe(ReminderTargetEnum)) target: ReminderTargetEnum, @Body() dto: SaveRemindersDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Reminders saved', payload: await this.reminders.saveMine(workspace(), user.id, target, dto.offsets) };
  }

  @Delete('mine/:target')
  @HttpCode(200)
  @ApiOperation({ summary: "Use the organisation's default reminders for a kind again" })
  async resetMine(@Param('target', new ParseEnumPipe(ReminderTargetEnum)) target: ReminderTargetEnum, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Reminders saved', payload: await this.reminders.resetMine(workspace(), user.id, target) };
  }
}
