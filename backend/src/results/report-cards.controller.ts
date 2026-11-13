import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { GenerateReportCardsDto, ReportCardsQueryDto, ShareReportCardsDto } from './dto/report-card.dto';
import { ReportCardsService } from './report-cards.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  return tenant;
};

/** Report cards (P7-04, PRF-09). Needs the `performance` feature. */
@ApiTags('Report cards')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.PERFORMANCE)
@Controller({ path: 'report-cards', version: '1' })
export class ReportCardsController {
  constructor(private readonly cards: ReportCardsService) {}

  @Get()
  @ApiOperation({ summary: "A section's students with their latest report card for a term (staff)" })
  async list(@Query() query: ReportCardsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report cards retrieved successfully', payload: await this.cards.list(workspace(), user.id, query.section_id, query.term_id) };
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make report cards with remarks; a changed card becomes a new version, an unchanged one is kept' })
  async generate(@Body() dto: GenerateReportCardsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report cards made', payload: await this.cards.generate(workspace(), user, dto) };
  }

  @Post('share')
  @HttpCode(200)
  @ApiOperation({ summary: "Send the latest cards to the students' guardians: a 30-day link that needs no login, by SMS (staff)" })
  async share(@Body() dto: ShareReportCardsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report cards shared', payload: await this.cards.share(workspace(), user, dto) };
  }

  @Get('print')
  @ApiOperation({ summary: "The latest cards of a section for a term, to print as one PDF (staff)" })
  async print(@Query() query: ReportCardsQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report cards retrieved successfully', payload: await this.cards.printable(workspace(), user.id, query.section_id, query.term_id) };
  }

  @Get('mine')
  @ApiOperation({ summary: "A student's own latest report cards" })
  async mine(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report cards retrieved successfully', payload: await this.cards.mine(workspace(), user.id) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'One report card: for staff of its section or the student it belongs to' })
  async one(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report card retrieved successfully', payload: await this.cards.one(workspace(), user.id, id) };
  }
}

/**
 * A report card shared with guardians (PRF-09): the link in the SMS opens it without signing in;
 * the token in the path is the key and works for 30 days.
 */
@ApiTags('Report cards')
@Controller({ path: 'public/report-cards', version: '1' })
export class PublicReportCardsController {
  constructor(private readonly cards: ReportCardsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'A shared report card by its link (no login; 30 days)' })
  async byLink(@Param('token') token: string) {
    return { message: 'Report card retrieved successfully', payload: await this.cards.byLink(token) };
  }
}
