import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ListInboxQueryDto, UpdateNotificationPrefDto } from './dto/inbox.dto';
import { NotificationEntity } from './entities/notification.entity';
import { UserNotificationPrefEntity } from './entities/user-notification-pref.entity';
import { NOTIFICATION_PREFERENCES, NotificationChannelEnum } from './notification.constants';

/** One kind of message and the channels the user gets it on. */
export interface NotificationPrefView {
  event_type: string;
  channels: NotificationChannelEnum[];
  allowed: NotificationChannelEnum[];
}

/** A user's in-app inbox (the bell) and channel choices (FND-12). Every query is the caller's own. */
@Injectable()
export class InboxService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepo: Repository<NotificationEntity>,
    @InjectRepository(UserNotificationPrefEntity)
    private readonly prefRepo: Repository<UserNotificationPrefEntity>,
  ) {}

  async list(userId: string, query: ListInboxQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.notificationRepo.findAndCount({
      where: { user_id: userId, ...(query.unread_only ? { read_at: IsNull() } : {}) },
      select: ['id', 'type', 'title', 'body', 'link', 'read_at', 'created_at', 'organization_id'],
      order: { created_at: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) || 1, unread: await this.unreadCount(userId) },
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { user_id: userId, read_at: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepo.findOne({ where: { id, user_id: userId } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.read_at) {
      notification.read_at = new Date();
      await this.notificationRepo.update({ id, user_id: userId }, { read_at: notification.read_at });
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo.update({ user_id: userId, read_at: IsNull() }, { read_at: new Date() });
    return { updated: result.affected ?? 0 };
  }

  async prefs(userId: string): Promise<NotificationPrefView[]> {
    const rows = await this.prefRepo.find({ where: { user_id: userId } });
    const chosen = new Map(rows.map((row) => [row.event_type, row.channels]));
    return Object.entries(NOTIFICATION_PREFERENCES).map(([eventType, preference]) => {
      const picked = chosen.get(eventType);
      return {
        event_type: eventType,
        channels: picked ? this.normalise(picked, preference.allowed) : preference.defaults,
        allowed: preference.allowed,
      };
    });
  }

  async updatePref(userId: string, dto: UpdateNotificationPrefDto): Promise<NotificationPrefView[]> {
    const preference = NOTIFICATION_PREFERENCES[dto.event_type];
    if (!preference) throw new BadRequestException(`"${dto.event_type}" has no channel choice`);
    const notAllowed = dto.channels.filter((channel) => !preference.allowed.includes(channel));
    if (notAllowed.length) throw new BadRequestException(`Not available for this message: ${notAllowed.join(', ')}`);
    await this.prefRepo.upsert(
      { user_id: userId, event_type: dto.event_type, channels: this.normalise(dto.channels, preference.allowed) },
      ['user_id', 'event_type'],
    );
    return this.prefs(userId);
  }

  /** Allowed channels only, in-app always, in a stable order. */
  private normalise(channels: string[], allowed: NotificationChannelEnum[]): NotificationChannelEnum[] {
    return allowed.filter((channel) => channel === NotificationChannelEnum.IN_APP || channels.includes(channel));
  }
}
