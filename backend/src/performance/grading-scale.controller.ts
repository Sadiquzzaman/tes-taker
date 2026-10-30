import { Body, Controller, Delete, ForbiddenException, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { UpdateGradingScaleDto } from './dto/grading-scale.dto';
import { GradingScaleService } from './grading-scale.service';

const MANAGERS = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

/** The current workspace's grading scale (FND-11). Not plan-gated: every mark on every plan has a grade. */
@ApiTags('Grading scale')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace; empty = your own workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
@Controller({ path: 'grading-scale', version: '1' })
export class GradingScaleController {
  constructor(private readonly gradingScales: GradingScaleService) {}

  @Get()
  @ApiOperation({ summary: "The workspace's grading scale: its own bands, or the Bangladesh national default" })
  async get() {
    const payload = await this.gradingScales.getScale(TenantContext.requireOrganizationId());
    return { message: 'Grading scale retrieved successfully', payload };
  }

  @Put()
  @ApiOperation({
    summary: 'Replace the bands (Owner/Admin)',
    description: 'Bands must cover 0–100% exactly once in 0.01 steps, with distinct grades. Errors carry a `code` (GRADING_SCALE_*). Raw marks never change.',
  })
  async replace(@Body() dto: UpdateGradingScaleDto, @UserPayload() user: JwtPayloadInterface) {
    const payload = await this.gradingScales.replace(requireManager(), dto, user);
    return { message: 'Grading scale saved successfully', payload };
  }

  @Delete()
  @ApiOperation({ summary: 'Go back to the Bangladesh national default (Owner/Admin); the custom scale is kept as history' })
  async reset(@UserPayload() user: JwtPayloadInterface) {
    const payload = await this.gradingScales.reset(requireManager(), user);
    return { message: 'Grading scale reset to the default', payload };
  }
}

/** Owners and admins (a solo teacher is OWNER of their own workspace). */
function requireManager(): string {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  if (tenant.viaEnrolment || !MANAGERS.includes(tenant.memberRole)) {
    throw new ForbiddenException('Only owners and admins can change the grading scale');
  }
  return tenant.organizationId;
}
