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
import { CreateHomeworkDto, ListHomeworkQueryDto, PublishHomeworkDto, UpdateHomeworkDto } from './dto/homework.dto';
import { HomeworkService } from './homework.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/**
 * Homework (Epic 2, HW-01 and HW-02): staff write, publish (now or later) and withdraw homework for
 * subject classes; students see what is set to them. Errors carry a `code` (HOMEWORK_*). Needs `homework`.
 */
@ApiTags('Homework')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.HOMEWORK)
@Controller({ path: 'homework', version: '1' })
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get()
  @ApiOperation({ summary: 'Homework the caller manages (staff), newest first; withdrawn ones with status=CANCELLED' })
  async list(@Query() query: ListHomeworkQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework retrieved successfully', payload: await this.homework.list(workspace(), user.id, query) };
  }

  @Get('subject-classes')
  @ApiOperation({ summary: 'Subject classes the caller may set homework for (all for owners, admins, assistants; their own for teachers)' })
  async subjectClasses(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Subject classes retrieved successfully', payload: await this.homework.subjectClasses(workspace(), user.id) };
  }

  @Get('mine')
  @ApiOperation({ summary: "The student's homework: published and set to them, soonest due first (HW-02)" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework retrieved successfully', payload: await this.homework.mine(workspace(), user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One homework (staff who may see it, or a student it is set to)' })
  async get(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework retrieved successfully', payload: await this.homework.get(workspace(), user.id, id) };
  }

  @Post()
  @ApiOperation({ summary: 'Write a homework (saved as a draft)', description: 'For one subject and one or more of its subject classes, or chosen students of them.' })
  async create(@Body() dto: CreateHomeworkDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework saved', payload: await this.homework.create(workspace(), user, dto) };
  }

  @Patch(':id')
  @ApiOperation({ summary: "Change a homework; a published one keeps its subject classes, students and type" })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHomeworkDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework saved', payload: await this.homework.update(workspace(), user, id, dto) };
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish now (students are told in the inbox) or schedule it with publish_at' })
  async publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishHomeworkDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework published', payload: await this.homework.publish(workspace(), user, id, dto) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw a homework (kept, never deleted); students no longer see it' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework withdrawn', payload: await this.homework.cancel(workspace(), user, id) };
  }
}
