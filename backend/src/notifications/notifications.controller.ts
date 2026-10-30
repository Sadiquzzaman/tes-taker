import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { RolesEnum } from 'src/common/enums/roles.enum';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { ListMessageLogQueryDto } from './dto/list-message-log-query.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import { MessageLogService } from './message-log.service';
import { MessageTemplatesService } from './message-templates.service';

/** Roles in an organisation that may read its message log (FND-14: org admins). */
const MESSAGE_LOG_ROLES = [OrganizationMemberRoleEnum.OWNER, OrganizationMemberRoleEnum.ADMIN];

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly messageLog: MessageLogService,
    private readonly templates: MessageTemplatesService,
  ) {}

  @Get('log')
  @UseGuards(AuthGuard('jwt'), OrganizationContextGuard)
  @ApiOperation({ summary: "The current workspace's message log: every SMS and email (owner and admins)" })
  async log(@Query() query: ListMessageLogQueryDto) {
    const tenant = TenantContext.current();
    if (!tenant || tenant.viaEnrolment || !MESSAGE_LOG_ROLES.includes(tenant.memberRole)) {
      throw new ForbiddenException('Only the owner and admins can see the message log');
    }
    const { messages, meta } = await this.messageLog.listForOrganization(query);
    return { message: 'Message log retrieved successfully', payload: messages, meta };
  }

  @Get('admin/templates')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform admin: the default message templates' })
  async listTemplates() {
    return { message: 'Message templates retrieved successfully', payload: await this.templates.listPlatform() };
  }

  @Patch('admin/templates/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform admin: edit a default message template (audited)' })
  async updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMessageTemplateDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Message template updated', payload: await this.templates.updatePlatform(id, dto, user.id) };
  }
}
