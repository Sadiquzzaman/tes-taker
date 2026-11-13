import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ChatDirectService } from './chat-direct.service';
import { ListChatMessagesQueryDto, MuteChatDto, SendChatMessageDto, StartDirectChatDto } from './dto/chat.dto';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose a school workspace first');
  return tenant;
};

/**
 * Private teacher–student chats (Epic 7, P9-02: COM-02, COM-03). Messages also arrive on the
 * `/chat` socket (`chat:message`, `chat:deleted`, `chat:read`). Needs `chat`.
 */
@ApiTags('Chat')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CHAT)
@Controller({ path: 'chat/direct', version: '1' })
export class ChatDirectController {
  constructor(private readonly direct: ChatDirectService) {}

  @Get()
  @ApiOperation({ summary: "The caller's private chats, most recent first, with unread counts and when the other person last read" })
  async list(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chats retrieved successfully', payload: await this.direct.list(workspace(), user.id) };
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Who the caller may message: a student their teachers, a teacher their students (open sessions)' })
  async contacts(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Contacts retrieved successfully', payload: await this.direct.contacts(workspace(), user.id) };
  }

  @Post()
  @ApiOperation({ summary: 'Open (or find) the private chat with one of your teachers or students' })
  async start(@Body() dto: StartDirectChatDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chat ready', payload: await this.direct.start(workspace(), user.id, dto.user_id) };
  }

  @Get(':chatId')
  @ApiOperation({ summary: 'One private chat' })
  async get(@Param('chatId', ParseUUIDPipe) chatId: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chat retrieved successfully', payload: await this.direct.get(workspace(), user.id, chatId) };
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Messages, newest first (30 at a time; before= for older)' })
  async messages(@Param('chatId', ParseUUIDPipe) chatId: string, @Query() query: ListChatMessagesQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Messages retrieved successfully', payload: await this.direct.history(workspace(), user.id, chatId, query) };
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send text and/or files, optionally replying to a message' })
  async send(@Param('chatId', ParseUUIDPipe) chatId: string, @Body() dto: SendChatMessageDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Message sent', payload: await this.direct.send(workspace(), user.id, chatId, dto) };
  }

  @Delete(':chatId/messages/:messageId')
  @ApiOperation({ summary: 'Delete one of your own messages' })
  async remove(@Param('chatId', ParseUUIDPipe) chatId: string, @Param('messageId', ParseUUIDPipe) messageId: string, @UserPayload() user: JwtPayloadInterface) {
    await this.direct.remove(workspace(), user.id, chatId, messageId);
    return { message: 'Message deleted', payload: null };
  }

  @Post(':chatId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark the chat read (the other person sees when)' })
  async read(@Param('chatId', ParseUUIDPipe) chatId: string, @UserPayload() user: JwtPayloadInterface) {
    await this.direct.markRead(workspace(), user.id, chatId);
    return { message: 'Marked as read', payload: null };
  }

  @Put(':chatId/mute')
  @ApiOperation({ summary: 'Mute or unmute the chat for yourself (no inbox notices)' })
  async mute(@Param('chatId', ParseUUIDPipe) chatId: string, @Body() dto: MuteChatDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Saved', payload: await this.direct.mute(workspace(), user.id, chatId, dto.muted) };
  }
}
