import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

/** Roles in an organisation that may read its audit log (owner decision, P2-09). */
const ORGANIZATION_LOG_ROLES = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

@ApiTags('Audit log')
@ApiBearerAuth('jwt')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: "The current workspace's audit log (owner and admins; no IP addresses)" })
  async listForOrganization(@Query() query: ListAuditLogsQueryDto) {
    const tenant = TenantContext.current();
    if (!tenant || tenant.viaEnrolment || !ORGANIZATION_LOG_ROLES.includes(tenant.memberRole)) {
      throw new ForbiddenException('Only the owner and admins can see the audit log');
    }
    const { logs, meta } = await this.auditService.listForOrganization(query);
    return { message: 'Audit log retrieved successfully', payload: logs, meta };
  }

  @Get('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform admin: the audit log of every organisation' })
  async listForPlatform(@Query() query: ListAuditLogsQueryDto) {
    const { logs, meta } = await this.auditService.listForPlatform(query);
    return { message: 'Audit log retrieved successfully', payload: logs, meta };
  }
}
