import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationContextGuard } from 'src/organizations/guards/organization-context.guard';
import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import { RequiresFeature } from 'src/subscriptions/decorators/requires-feature.decorator';
import { FeatureGuard } from 'src/subscriptions/guards/feature.guard';
import { ChatGroupsService } from './chat-groups.service';
import { ListChatMessagesQueryDto, MuteChatDto, PinChatMessageDto, SendChatMessageDto, UpdateGroupChatDto } from './dto/chat.dto';

const workspace = (): Tenant => {
  const tenant = TenantContext.current();
  if (!tenant || tenant.viaEnrolment) throw new ForbiddenException('Choose a school workspace first');
  return tenant;
};

/**
 * Group chats (Epic 7, P9-01: COM-01, COM-03): one per subject class, for its students and
 * teachers. New messages also arrive on the `/chat` socket. Errors carry a `code` (CHAT_*).
 * Needs `chat`.
 */
@ApiTags('Chat')
@ApiBearerAuth('jwt')
@ApiHeader({ name: 'X-Organization-Id', required: false, description: 'Organisation workspace' })
@UseGuards(AuthGuard('jwt'), OrganizationContextGuard, FeatureGuard)
@RequiresFeature(FeatureKey.CHAT)
@Controller({ path: 'chat/groups', version: '1' })
export class ChatController {
  constructor(private readonly groups: ChatGroupsService) {}

  @Get()
  @ApiOperation({ summary: "The caller's group chats (subject classes they teach or take, open sessions) with unread counts, most recent first" })
  async list(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chats retrieved successfully', payload: await this.groups.myGroups(workspace(), user.id) };
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'One group chat: name, teachers, your role, announcement mode, pinned posts' })
  async get(@Param('groupId', ParseUUIDPipe) groupId: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chat retrieved successfully', payload: await this.groups.getGroup(workspace(), user.id, groupId) };
  }

  @Patch(':groupId')
  @ApiOperation({ summary: 'Turn "Only teachers can post" on or off (teachers of the group)' })
  async update(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: UpdateGroupChatDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Chat updated', payload: await this.groups.update(workspace(), user.id, groupId, dto.announcement_only) };
  }

  @Get(':groupId/messages')
  @ApiOperation({ summary: 'Posts, newest first (30 at a time; before= for older)' })
  async posts(@Param('groupId', ParseUUIDPipe) groupId: string, @Query() query: ListChatMessagesQueryDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Messages retrieved successfully', payload: await this.groups.posts(workspace(), user.id, groupId, query) };
  }

  @Post(':groupId/messages')
  @ApiOperation({ summary: 'Post, or comment on a post (parent_id); text and/or files, optionally replying to a message' })
  async send(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: SendChatMessageDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Message sent', payload: await this.groups.send(workspace(), user.id, groupId, dto) };
  }

  @Get(':groupId/messages/:messageId/comments')
  @ApiOperation({ summary: "A post's comments, oldest first" })
  async comments(@Param('groupId', ParseUUIDPipe) groupId: string, @Param('messageId', ParseUUIDPipe) messageId: string, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Comments retrieved successfully', payload: await this.groups.comments(workspace(), user.id, groupId, messageId) };
  }

  @Delete(':groupId/messages/:messageId')
  @ApiOperation({ summary: "Delete a message: your own, or (teachers of the group) anyone's" })
  async remove(@Param('groupId', ParseUUIDPipe) groupId: string, @Param('messageId', ParseUUIDPipe) messageId: string, @UserPayload() user: JwtPayloadInterface) {
    await this.groups.remove(workspace(), user.id, groupId, messageId);
    return { message: 'Message deleted', payload: null };
  }

  @Put(':groupId/messages/:messageId/pin')
  @ApiOperation({ summary: 'Pin or unpin a post (teachers of the group; at most 3 pinned)' })
  async pin(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: PinChatMessageDto,
    @UserPayload() user: JwtPayloadInterface,
  ) {
    return { message: 'Pins updated', payload: await this.groups.pin(workspace(), user.id, groupId, messageId, dto.pinned) };
  }

  @Post(':groupId/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark everything in the group as read' })
  async read(@Param('groupId', ParseUUIDPipe) groupId: string, @UserPayload() user: JwtPayloadInterface) {
    await this.groups.markRead(workspace(), user.id, groupId);
    return { message: 'Marked as read', payload: null };
  }

  @Put(':groupId/mute')
  @ApiOperation({ summary: 'Mute or unmute the group for yourself (no announcement notices)' })
  async mute(@Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: MuteChatDto, @UserPayload() user: JwtPayloadInterface) {
    return { message: 'Saved', payload: await this.groups.mute(workspace(), user.id, groupId, dto.muted) };
  }
}
