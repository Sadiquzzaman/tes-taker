import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ChatModerationService } from './chat-moderation.service';
import { CloseChatDto, ListChatMessagesQueryDto, ListReportsQueryDto, MuteChatUserDto, OpenChatDto, ReportMessageDto, ResolveReportDto } from './dto/chat.dto';
import { ChatTypeEnum } from './entities/chat-access-log.entity';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose a school workspace first');
  return tenant;
};
const typePipe = new ParseEnumPipe(ChatTypeEnum);

/**
 * Supervising chats (Epic 7, P9-02: COM-04, COM-05). Owners and admins: every chat by name, open
 * one with a reason (logged), then for 2 hours read it, delete messages, mute a person, close or
 * reopen it; the report queue. The owner reads the access log. Needs `chat`.
 */
@ApiTags('Chat')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CHAT)
@Controller({ path: 'chat', version: '1' })
export class ChatAdminController {
  constructor(private readonly moderation: ChatModerationService) {}

  @Post('reports')
  @ApiOperation({ summary: 'Report a message in a chat you are in (COM-05); owners and admins are told' })
  async report(@Body() dto: ReportMessageDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Thanks — the school will review it', payload: await this.moderation.report(workspace(), user.id, dto.chat_type, dto.chat_id, dto.message_id, dto.reason) };
  }

  @Get('admin/chats')
  @ApiOperation({ summary: 'Every chat of the organisation by name (owners and admins); messages need an opening with a reason' })
  async chats() {
    return { message: 'Chats retrieved successfully', payload: await this.moderation.chats(workspace()) };
  }

  @Post('admin/chats/:type/:chatId/open')
  @HttpCode(200)
  @ApiOperation({ summary: 'Open a chat with a reason (logged); returns its latest messages' })
  async open(
    @Param('type', typePipe) type: ChatTypeEnum,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: OpenChatDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Chat opened', payload: await this.moderation.open(workspace(), user.id, type, chatId, dto.reason) };
  }

  @Get('admin/chats/:type/:chatId/messages')
  @ApiOperation({ summary: 'Messages of a chat you opened in the last 2 hours, newest first' })
  async messages(
    @Param('type', typePipe) type: ChatTypeEnum,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Query() query: ListChatMessagesQueryDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Messages retrieved successfully', payload: await this.moderation.history(workspace(), user.id, type, chatId, query) };
  }

  @Delete('admin/chats/:type/:chatId/messages/:messageId')
  @ApiOperation({ summary: 'Delete a message (audited)' })
  async remove(
    @Param('type', typePipe) type: ChatTypeEnum,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    await this.moderation.deleteMessage(workspace(), user.id, type, chatId, messageId);
    return { message: 'Message deleted', payload: null };
  }

  @Post('admin/chats/:type/:chatId/mutes')
  @ApiOperation({ summary: 'Stop one member writing in the chat for some hours (audited)' })
  async mute(
    @Param('type', typePipe) type: ChatTypeEnum,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: MuteChatUserDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Muted', payload: await this.moderation.muteUser(workspace(), user.id, type, chatId, dto.user_id, dto.hours, dto.reason ?? '') };
  }

  @Put('admin/chats/:type/:chatId/closed')
  @ApiOperation({ summary: 'Close a chat (read-only for everyone) or reopen it (audited)' })
  async close(
    @Param('type', typePipe) type: ChatTypeEnum,
    @Param('chatId', ParseUUIDPipe) chatId: string,
    @Body() dto: CloseChatDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: dto.closed ? 'Chat closed' : 'Chat reopened', payload: await this.moderation.close(workspace(), user.id, type, chatId, dto.closed) };
  }

  @Get('admin/access-log')
  @ApiOperation({ summary: 'Who opened which chat, when and why (the owner only)' })
  async accessLog() {
    return { message: 'Access log retrieved successfully', payload: await this.moderation.accessLog(workspace()) };
  }

  @Get('admin/reports')
  @ApiOperation({ summary: 'Reported messages with their context (owners and admins); status=OPEN by default' })
  async reports(@Query() query: ListReportsQueryDto) {
    return { message: 'Reports retrieved successfully', payload: await this.moderation.reportQueue(workspace(), query.status) };
  }

  @Post('admin/reports/:reportId/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve a report: keep or delete the message (audited)' })
  async resolve(@Param('reportId', ParseUUIDPipe) reportId: string, @Body() dto: ResolveReportDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Report resolved', payload: await this.moderation.resolve(workspace(), user.id, reportId, dto.resolution) };
  }
}
