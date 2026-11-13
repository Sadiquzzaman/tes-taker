import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { OverviewQueryDto, SaveScoreWeightsDto, ScoreWeightsQueryDto, SectionScoresQueryDto, StudentScoresQueryDto, UpdatePerformanceSettingsDto } from './dto/scores.dto';
import { ScoreSettingsService } from './score-settings.service';
import { ScoresService } from './scores.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/** Scores, weights and performance settings (P7-02, P7-03; PRF-01, PRF-05–07, PRF-10). Needs the `performance` feature. */
@ApiTags('Scores')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.PERFORMANCE)
@Controller({ path: 'scores', version: '1' })
export class ScoresController {
  constructor(
    private readonly scores: ScoresService,
    private readonly settings: ScoreSettingsService,
  ) {}

  @Get('weights')
  @ApiOperation({ summary: "Each class's score weights for a session (the default 50/20/20/10 where none are set)" })
  async weights(@Query() query: ScoreWeightsQueryDto) {
    return { message: 'Weights retrieved successfully', payload: await this.settings.weights(workspace(), query.session_id) };
  }

  @Put('weights')
  @ApiOperation({ summary: "Set a class's weights for a session (owners and admins); they add up to 100" })
  async saveWeights(@Body() dto: SaveScoreWeightsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Weights saved', payload: await this.settings.saveWeights(workspace(), user, dto) };
  }

  @Get('settings')
  @ApiOperation({ summary: 'At-risk limits and whether students see their position' })
  async readSettings() {
    return { message: 'Settings retrieved successfully', payload: await this.settings.settings(workspace()) };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Change the at-risk limits or the position setting (owners and admins)' })
  async saveSettings(@Body() dto: UpdatePerformanceSettingsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Settings saved', payload: await this.settings.saveSettings(workspace(), user, dto) };
  }

  @Get('overview')
  @ApiOperation({ summary: 'The whole school: each section and each subject for a term or the session (owners, admins and staff)' })
  async overview(@Query() query: OverviewQueryDto) {
    return { message: 'Overview retrieved successfully', payload: await this.scores.overview(workspace(), query.session_id, query.term_id) };
  }

  @Get('sections')
  @ApiOperation({ summary: "The sections of a session whose scores you see (owners, admins and staff all; a teacher the ones they look after), with the session's terms" })
  async sections(@Query() query: ScoreWeightsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Sections retrieved successfully', payload: await this.scores.visibleSections(workspace(), user.id, query.session_id) };
  }

  @Get('students/:id')
  @ApiOperation({ summary: "A student's performance: subjects, every exam and homework, trend per term, strengths; a student sees their own published results" })
  async student(@Param('id', ParseUUIDPipe) id: string, @Query() query: StudentScoresQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Performance retrieved successfully', payload: await this.scores.student(workspace(), user.id, id, query.section_id, query.term_id) };
  }

  @Get('sections/:id')
  @ApiOperation({ summary: "A section's live scores for a term or the session: per student, per subject and overall, with positions and at-risk flags" })
  async section(@Param('id', ParseUUIDPipe) id: string, @Query() query: SectionScoresQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Scores retrieved successfully', payload: await this.scores.section(workspace(), user.id, id, query.term_id) };
  }
}
