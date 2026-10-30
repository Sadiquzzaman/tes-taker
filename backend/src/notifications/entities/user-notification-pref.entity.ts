import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * The channels a user chose for one kind of message (FND-12: "users choose their own channels").
 * No row = the event's default (NOTIFICATION_PREFERENCES). In-app is always on.
 */
@Entity('user_notification_prefs')
export class UserNotificationPrefEntity {
  @ApiProperty()
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @ApiProperty({ example: 'exam.scheduled' })
  @PrimaryColumn({ name: 'event_type', type: 'varchar', length: 60 })
  event_type: string;

  @ApiProperty({ example: ['IN_APP', 'SMS'] })
  @Column({ name: 'channels', type: 'varchar', length: 10, array: true })
  channels: string[];

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
