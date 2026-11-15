import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { IntegrityScopeDto, PlagiarismThresholdsDto, ReviewMatchDto } from './dto/integrity.dto';
import { IntegrityService } from './integrity.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose your organisation first');
  return tenant;
};

/** Plagiarism checks (Epic 10, PLG-01–03): staff only. Errors carry a `code` (INTEGRITY_*). Needs `integrity`. */
@ApiTags('Integrity')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.INTEGRITY)
@Controller({ path: 'integrity', version: '1' })
export class IntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Get('checks/latest')
  @ApiOperation({ summary: 'Staff: the latest plagiarism results of a homework or an IELTS opening’s Writing (runs once by itself after the due date)' })
  async latest(@Query() scope: IntegrityScopeDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Results retrieved successfully', payload: await this.integrity.latest(workspace(), user.id, scope) };
  }

  @Post('checks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Staff: compare the submissions now' })
  async run(@Body() scope: IntegrityScopeDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Check finished', payload: await this.integrity.run(workspace(), user.id, scope) };
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Staff: two submissions side by side with the matching passages' })
  async match(@Param('id', ParseUUIDPipe) id: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Match retrieved successfully', payload: await this.integrity.match(workspace(), user.id, id) };
  }

  @Put('matches/:id/review')
  @ApiOperation({ summary: 'Staff: "Reviewed — OK" or "Copied", with a note' })
  async review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewMatchDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Review saved', payload: await this.integrity.review(workspace(), user.id, id, dto) };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Staff: similarity % for High and Medium, and the fewest words checked' })
  async settings() {
    return { message: 'Settings retrieved successfully', payload: await this.integrity.getSettings(workspace()) };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Owners and admins: set the thresholds' })
  async updateSettings(@Body() dto: PlagiarismThresholdsDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Settings saved', payload: await this.integrity.updateSettings(workspace(), user.id, dto) };
  }
}
