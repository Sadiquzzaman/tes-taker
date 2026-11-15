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
import { ListIeltsProfilesQueryDto, UpdateIeltsProfileDto } from './dto/ielts-profile.dto';
import { IeltsProfilesService } from './ielts-profiles.service';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose your IELTS centre first');
  return tenant;
};

/**
 * The IELTS workspace (Epic 11, P10): IELTS centres only. Student profiles (IEL-02) so far.
 * Errors carry a `code` (IELTS_*). Needs `ielts`.
 */
@ApiTags('IELTS')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.IELTS)
@Controller({ path: 'ielts', version: '1' })
export class IeltsController {
  constructor(private readonly profiles: IeltsProfilesService) {}

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
}
