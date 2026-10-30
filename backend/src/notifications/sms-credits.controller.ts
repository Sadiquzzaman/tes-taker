import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { AUDIT_ACTIONS } from 'src/audit/audit-actions';
import { AuditService } from 'src/audit/audit.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AdminSmsTopUpDto } from './dto/sms-credits.dto';
import { SmsCreditsService } from './sms-credits.service';

/** Who in a workspace sees its SMS credits: the owner and admins (who also read the message log). */
const CREDIT_ROLES = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

@ApiTags('SMS credits')
@ApiBearerAuth('jwt')
@Controller({ path: 'sms-credits', version: '1' })
export class SmsCreditsController {
  constructor(
    private readonly credits: SmsCreditsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: "The current workspace's SMS credits: this month's allowance, top-ups and packs (FND-13)" })
  async mine() {
    const tenant = TenantContext.current();
    if (!tenant || tenant.viaEnrolment || !CREDIT_ROLES.includes(tenant.memberRole)) {
      throw new ForbiddenException('Only the owner and admins can see SMS credits');
    }
    return { message: 'SMS credits retrieved successfully', payload: await this.credits.summary(tenant.organizationId) };
  }

  @Get('admin/:organizationId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: "Platform admin: an organisation's SMS credits" })
  async forOrganization(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return { message: 'SMS credits retrieved successfully', payload: await this.credits.summary(organizationId) };
  }

  @Post('admin/:organizationId/top-ups')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform admin: add top-up credits to an organisation (audited)' })
  async topUp(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: AdminSmsTopUpDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    const { summary } = await this.credits.addTopUp(organizationId, dto.credits, { note: dto.reason, createdBy: user.id });
    this.audit.record({
      action: AUDIT_ACTIONS.SMS_CREDITS_TOP_UP,
      organizationId,
      actorId: user.id,
      entityType: 'organization',
      entityId: organizationId,
      after: { credits: dto.credits, top_up_left: summary.top_up.left },
      reason: dto.reason,
    });
    return { message: 'SMS credits added', payload: summary };
  }
}
