import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import {
  CreateHomeworkDto,
  ListHomeworkQueryDto,
  PublishHomeworkDto,
  RemindMissingDto,
  ReturnSubmissionDto,
  SaveHomeworkScoresDto,
  SubmitHomeworkDto,
  UpdateHomeworkDto,
  UpdateHomeworkSettingsDto,
} from './dto/homework.dto';
import { HomeworkScoresService } from './homework-scores.service';
import { HomeworkSettingsService } from './homework-settings.service';
import { HomeworkSubmissionsService } from './homework-submissions.service';
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
  constructor(
    private readonly homework: HomeworkService,
    private readonly submissions: HomeworkSubmissionsService,
    private readonly settings: HomeworkSettingsService,
    private readonly scores: HomeworkScoresService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Homework the caller manages (staff), newest first; withdrawn ones with status=CANCELLED' })
  async list(@Query() query: ListHomeworkQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework retrieved successfully', payload: await this.homework.list(workspace(), user.id, query) };
  }

  @Get('settings')
  @ApiOperation({ summary: "The organisation's homework settings: late work, late penalty, resubmissions, files per hand-in (staff)" })
  async getSettings() {
    return { message: 'Homework settings retrieved successfully', payload: await this.settings.get(workspace()) };
  }

  @Patch('settings')
  @ApiOperation({ summary: "Change the organisation's homework settings (owners and admins)" })
  async updateSettings(@Body() dto: UpdateHomeworkSettingsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework settings saved', payload: await this.settings.update(workspace(), user.id, dto) };
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

  @Get(':id/my-submissions')
  @ApiOperation({ summary: "The student's hand-ins of this homework, newest first, and whether they may hand in now (HW-03)" })
  async mySubmissions(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Submissions retrieved successfully', payload: await this.submissions.mine(workspace(), user.id, id) };
  }

  @Post(':id/submissions')
  @ApiOperation({
    summary: 'Hand the homework in (students)',
    description: 'Files and/or a typed answer. Late after the due time (or refused when late work is not accepted); again up to the limit until it is scored.',
  })
  async submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitHomeworkDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework handed in', payload: await this.submissions.submit(workspace(), user.id, id, dto) };
  }

  @Get(':id/submissions')
  @ApiOperation({ summary: 'Every student it is set to, with their latest hand-in (staff)' })
  async submissionsForStaff(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Submissions retrieved successfully', payload: await this.submissions.forStaff(workspace(), user.id, id) };
  }

  @Get(':id/submissions/:submissionId')
  @ApiOperation({ summary: "One hand-in with its answer and files, and the student's other versions (staff)" })
  async submissionForStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Submission retrieved successfully', payload: await this.submissions.oneForStaff(workspace(), user.id, id, submissionId) };
  }

  @Get(':id/grid')
  @ApiOperation({ summary: 'Review, paper grid and overview: every student with their latest hand-in and score, and the counts (staff; HW-04–06)' })
  async grid(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework scores retrieved successfully', payload: await this.scores.grid(workspace(), user.id, id) };
  }

  @Put(':id/scores')
  @ApiOperation({
    summary: 'Save scores for one or many students (staff; HW-04, HW-05)',
    description: 'Out of the total marks; the late penalty is taken off automatically. is_missing = never handed in (final 0). Optional 1–5 ratings.',
  })
  async saveScores(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveHomeworkScoresDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Scores saved', payload: await this.scores.save(workspace(), user, id, dto.rows) };
  }

  @Post(':id/submissions/:submissionId/return')
  @HttpCode(200)
  @ApiOperation({ summary: "Return a student's latest hand-in for redo: one more hand-in is allowed; the student is told (staff)" })
  async returnForRedo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReturnSubmissionDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Returned for redo', payload: await this.scores.returnForRedo(workspace(), user, id, submissionId, dto) };
  }

  @Post(':id/publish-scores')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish the scores: students see their score and feedback and are told (staff)' })
  async publishScores(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Scores published', payload: await this.scores.publishScores(workspace(), user, id) };
  }

  @Post(':id/remind-missing')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remind students who have not handed it in (in-app), and optionally SMS their guardians (staff; HW-06)' })
  async remindMissing(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RemindMissingDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Reminders sent', payload: await this.scores.remindMissing(workspace(), user, id, dto) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw a homework (kept, never deleted); students no longer see it' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Homework withdrawn', payload: await this.homework.cancel(workspace(), user, id) };
  }
}
