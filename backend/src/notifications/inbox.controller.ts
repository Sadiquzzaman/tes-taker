import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { UserPayload } from 'src/common/decorators/user-payload.decorator';
import { ListInboxQueryDto, UpdateNotificationPrefDto } from './dto/inbox.dto';
import { InboxService } from './inbox.service';

/** The signed-in user's in-app notifications (the bell) and channel choices (FND-12). */
@ApiTags('Notifications')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'me', version: '1' })
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'My in-app notifications, newest first (meta.unread = unread count)' })
  async list(@UserPayload() user: JwtPayloadInterface, @Query() query: ListInboxQueryDto) {
    const { items, meta } = await this.inbox.list(user.id, query);
    return { message: 'Notifications retrieved successfully', payload: items, meta };
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'How many of my notifications are unread (the bell badge)' })
  async unreadCount(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Unread count retrieved successfully', payload: { count: await this.inbox.unreadCount(user.id) } };
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one of my notifications as read' })
  async markRead(@UserPayload() user: JwtPayloadInterface, @Param('id', ParseUUIDPipe) id: string) {
    return { message: 'Notification marked as read', payload: await this.inbox.markRead(user.id, id) };
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  async markAllRead(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Notifications marked as read', payload: await this.inbox.markAllRead(user.id) };
  }

  @Get('notification-prefs')
  @ApiOperation({ summary: 'The channels I get each kind of message on (in-app is always on)' })
  async prefs(@UserPayload() user: JwtPayloadInterface) {
    return { message: 'Notification settings retrieved successfully', payload: await this.inbox.prefs(user.id) };
  }

  @Put('notification-prefs')
  @ApiOperation({ summary: 'Choose the channels for one kind of message' })
  async updatePref(@UserPayload() user: JwtPayloadInterface, @Body() dto: UpdateNotificationPrefDto) {
    return { message: 'Notification settings saved', payload: await this.inbox.updatePref(user.id, dto) };
  }
}
