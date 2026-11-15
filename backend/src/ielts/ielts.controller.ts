import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { CreateIeltsAssignmentDto, SaveIeltsAnswersDto, SubmitIeltsAttemptDto, UpdateIeltsAssignmentDto } from './dto/ielts-attempt.dto';
import { IeltsBandTableScopeDto, UpdateIeltsBandTableDto } from './dto/ielts-band-table.dto';
import { ListIeltsMarkingQueryDto, MarkIeltsWritingDto } from './dto/ielts-marking.dto';
import { IeltsMarkingService } from './ielts-marking.service';
import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsAssignmentsService } from './ielts-assignments.service';
import { IeltsAttemptsService } from './ielts-attempts.service';
import { OrderIeltsGroupsDto, SaveIeltsGroupDto } from './dto/ielts-group.dto';
import { ListIeltsProfilesQueryDto, UpdateIeltsProfileDto } from './dto/ielts-profile.dto';
import { CreateIeltsTestDto, ListIeltsTestsQueryDto, UpdateIeltsTestDto, UpdateIeltsTestPartDto } from './dto/ielts-test.dto';
import { IeltsBandTablesService } from './ielts-band-tables.service';
import { IeltsGroupsService } from './ielts-groups.service';
import { IeltsProfilesService } from './ielts-profiles.service';
import { IeltsTestsService } from './ielts-tests.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose your IELTS centre first');
  return tenant;
};

/**
 * The IELTS workspace (Epic 11, P10): IELTS centres only. Student profiles (IEL-02), band tables
 * (IEL-04, IEL-05), IELTS tests (IEL-03), openings for batches and attempts (IEL-04, IEL-05, IEL-08).
 * Errors carry a `code` (IELTS_*). Needs `ielts`.
 */
@ApiTags('IELTS')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.IELTS)
@Controller({ path: 'ielts', version: '1' })
export class IeltsController {
  constructor(
    private readonly profiles: IeltsProfilesService,
    private readonly bandTables: IeltsBandTablesService,
    private readonly tests: IeltsTestsService,
    private readonly groups: IeltsGroupsService,
    private readonly assignments: IeltsAssignmentsService,
    private readonly attempts: IeltsAttemptsService,
    private readonly marking: IeltsMarkingService,
  ) {}

  @Get('profiles')
  @ApiOperation({ summary: 'Staff: every student of the centre (or one batch: section_id) with test type, targets and test date' })
  async list(@Query() query: ListIeltsProfilesQueryDto) {
    return { message: 'Profiles retrieved successfully', payload: await this.profiles.list(workspace(), query.section_id) };
  }

  @Get('profiles/me')
  @ApiOperation({ summary: "Students: your own IELTS profile (with days to your test)" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Profile retrieved successfully', payload: await this.profiles.get(workspace(), user.id, user.id) };
  }

  @Get('profiles/:studentId')
  @ApiOperation({ summary: "One student's IELTS profile (staff; a student only their own)" })
  async get(@Param('studentId', ParseUUIDPipe) studentId: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Profile retrieved successfully', payload: await this.profiles.get(workspace(), user.id, studentId) };
  }

  @Put('profiles/:studentId')
  @ApiOperation({ summary: "Set a student's test type, target bands (0–9 in half bands) and test date (staff)" })
  async update(@Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: UpdateIeltsProfileDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Profile saved', payload: await this.profiles.update(workspace(), user.id, studentId, dto) };
  }

  @Get('band-tables')
  @ApiOperation({ summary: 'Staff: the raw → band tables for Listening and Reading (Academic, General Training): the centre’s own or the default' })
  async bandTablesList() {
    return { message: 'Band tables retrieved successfully', payload: await this.bandTables.list(workspace()) };
  }

  @Put('band-tables')
  @ApiOperation({ summary: 'Owners and admins: save the centre’s own copy of one band table' })
  async bandTablesUpdate(@Body() dto: UpdateIeltsBandTableDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Band table saved', payload: await this.bandTables.update(workspace(), user.id, dto) };
  }

  @Post('band-tables/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Owners and admins: put one band table back to the default' })
  async bandTablesReset(@Body() dto: IeltsBandTableScopeDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Band table reset', payload: await this.bandTables.reset(workspace(), user.id, dto) };
  }

  @Get('tests')
  @ApiOperation({ summary: 'Staff: the centre’s IELTS tests (mocks and practice sets), with question counts per module' })
  async testsList(@Query() query: ListIeltsTestsQueryDto) {
    return { message: 'Tests retrieved successfully', payload: await this.tests.list(workspace(), query) };
  }

  @Post('tests')
  @ApiOperation({ summary: 'Staff: a new draft test; a mock gets every part of its modules, a practice set the chosen parts of one module' })
  async testsCreate(@Body() dto: CreateIeltsTestDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test created', payload: await this.tests.create(workspace(), user.id, dto) };
  }

  @Get('tests/:id')
  @ApiOperation({ summary: 'Staff: one test with its parts, question groups and questions (with answers)' })
  async testsGet(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test retrieved successfully', payload: await this.tests.get(workspace(), user.id, id) };
  }

  @Patch('tests/:id')
  @ApiOperation({ summary: 'The maker, owners and admins: the title; while a draft, the test type and time per module' })
  async testsUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIeltsTestDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test saved', payload: await this.tests.update(workspace(), user.id, id, dto) };
  }

  @Delete('tests/:id')
  @ApiOperation({ summary: 'The maker, owners and admins: delete a test (kept, hidden)' })
  async testsRemove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.tests.remove(workspace(), user.id, id);
    return { message: 'Test deleted', payload: null };
  }

  @Put('tests/:id/parts/:partId')
  @ApiOperation({ summary: 'Drafts: a part’s title, text (passage, task, questions), Listening recording or picture' })
  async testsUpdatePart(@Param('id', ParseUUIDPipe) id: string, @Param('partId', ParseUUIDPipe) partId: string, @Body() dto: UpdateIeltsTestPartDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Part saved', payload: await this.tests.updatePart(workspace(), user.id, id, partId, dto) };
  }

  @Post('tests/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a complete draft (422 IELTS_TEST_INCOMPLETE with details.problems otherwise)' })
  async testsPublish(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test published', payload: await this.tests.publish(workspace(), user.id, id) };
  }

  @Post('tests/:id/unpublish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Back to a draft, to change it' })
  async testsUnpublish(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test moved to drafts', payload: await this.tests.unpublish(workspace(), user.id, id) };
  }

  @Post('tests/:id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive a test (kept, no longer offered)' })
  async testsArchive(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test archived', payload: await this.tests.archive(workspace(), user.id, id) };
  }

  @Post('tests/:id/duplicate')
  @ApiOperation({ summary: 'Staff: a draft copy of a test, made yours' })
  async testsDuplicate(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test copied', payload: await this.tests.duplicate(workspace(), user.id, id) };
  }

  @Post('tests/:id/parts/:partId/groups')
  @ApiOperation({ summary: 'Drafts: add a question group (with its questions and answers) to a Listening part or Reading passage' })
  async groupsCreate(@Param('id', ParseUUIDPipe) id: string, @Param('partId', ParseUUIDPipe) partId: string, @Body() dto: SaveIeltsGroupDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Question group added', payload: await this.groups.create(workspace(), user.id, id, partId, dto) };
  }

  @Put('tests/:id/parts/:partId/groups/order')
  @ApiOperation({ summary: 'Drafts: put a part’s question groups in a new order' })
  async groupsOrder(@Param('id', ParseUUIDPipe) id: string, @Param('partId', ParseUUIDPipe) partId: string, @Body() dto: OrderIeltsGroupsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Order saved', payload: await this.groups.reorder(workspace(), user.id, id, partId, dto) };
  }

  @Put('tests/:id/groups/:groupId')
  @ApiOperation({ summary: 'Drafts: save a question group; questions sent with their id are kept, the rest hidden' })
  async groupsUpdate(@Param('id', ParseUUIDPipe) id: string, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SaveIeltsGroupDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Question group saved', payload: await this.groups.update(workspace(), user.id, id, groupId, dto) };
  }

  @Delete('tests/:id/groups/:groupId')
  @ApiOperation({ summary: 'Drafts: remove a question group (hidden with its questions)' })
  async groupsRemove(@Param('id', ParseUUIDPipe) id: string, @Param('groupId', ParseUUIDPipe) groupId: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Question group removed', payload: await this.groups.remove(workspace(), user.id, id, groupId) };
  }

  @Post('tests/:id/assignments')
  @ApiOperation({ summary: 'Staff: open a published test for a batch between two times' })
  async assignmentsCreate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateIeltsAssignmentDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Test opened for the batch', payload: await this.assignments.create(workspace(), user.id, id, dto) };
  }

  @Get('tests/:id/assignments')
  @ApiOperation({ summary: 'Staff: a test’s openings with batch size and hand-ins per module' })
  async assignmentsList(@Param('id', ParseUUIDPipe) id: string) {
    return { message: 'Openings retrieved successfully', payload: await this.assignments.list(workspace(), id) };
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Staff: change an opening’s window' })
  async assignmentsUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIeltsAssignmentDto) {
    return { message: 'Opening saved', payload: await this.assignments.update(workspace(), id, dto) };
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Staff: remove an opening (hidden from students; attempts kept)' })
  async assignmentsRemove(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    await this.assignments.remove(workspace(), user.id, id);
    return { message: 'Opening removed', payload: null };
  }

  @Get('assignments/:id/results')
  @ApiOperation({ summary: 'Staff: each student of the batch with raw score and band per module' })
  async assignmentsResults(@Param('id', ParseUUIDPipe) id: string) {
    return { message: 'Results retrieved successfully', payload: await this.assignments.results(workspace(), id) };
  }

  @Get('my/assignments')
  @ApiOperation({ summary: 'Students: IELTS tests opened for your batches, with your attempts per module' })
  async myAssignments(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Tests retrieved successfully', payload: await this.attempts.listMine(workspace(), user.id) };
  }

  @Post('my/assignments/:id/modules/:module/start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Students: start a module (or resume it while its time lasts); the paper without answers' })
  async myStart(@Param('id', ParseUUIDPipe) id: string, @Param('module', new ParseEnumPipe(IeltsModuleEnum)) module: IeltsModuleEnum, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Module started', payload: await this.attempts.start(workspace(), user.id, id, module) };
  }

  @Get('my/attempts/:id')
  @ApiOperation({ summary: 'Students: the paper while in progress, or the result (with answers when they may be shown)' })
  async myAttempt(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Attempt retrieved successfully', payload: await this.attempts.get(workspace(), user.id, id) };
  }

  @Put('my/attempts/:id/answers')
  @ApiOperation({ summary: 'Students: save answers while the time lasts' })
  async mySave(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveIeltsAnswersDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Answers saved', payload: await this.attempts.save(workspace(), user.id, id, dto.answers) };
  }

  @Post('my/attempts/:id/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Students: hand in a module; Listening and Reading are marked out of 40 with their band' })
  async mySubmit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitIeltsAttemptDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Module handed in', payload: await this.attempts.submit(workspace(), user.id, id, dto.answers) };
  }

  @Get('marking')
  @ApiOperation({ summary: 'Staff: handed-in Writing waiting for marks (state=MARKED for marked ones), oldest first' })
  async markingList(@Query() query: ListIeltsMarkingQueryDto) {
    return { message: 'Attempts retrieved successfully', payload: await this.marking.list(workspace(), query) };
  }

  @Get('marking/:attemptId')
  @ApiOperation({ summary: 'Staff: a handed-in Writing attempt with tasks, scripts, word counts and marks' })
  async markingGet(@Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return { message: 'Attempt retrieved successfully', payload: await this.marking.get(workspace(), attemptId) };
  }

  @Put('marking/:attemptId/writing')
  @ApiOperation({ summary: 'Staff: bands for TA/TR, CC, LR, GRA per task, comments and feedback; Task 2 counts double' })
  async markingWriting(@Param('attemptId', ParseUUIDPipe) attemptId: string, @Body() dto: MarkIeltsWritingDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Marks saved', payload: await this.marking.markWriting(workspace(), user.id, attemptId, dto) };
  }
}
