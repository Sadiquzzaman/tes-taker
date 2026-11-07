import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';

/** What a reminder rule is for (CAL-05). */
export enum ReminderTargetEnum {
  CLASS = 'CLASS',
  EXAM = 'EXAM',
  EVENT = 'EVENT',
}

/** How a reminder is sent: in the app (push with the mobile app later) or by SMS on org credits. */
export type ReminderChannel = 'IN_APP' | 'SMS';

/** One reminder: this many minutes before the start, on this channel. */
export interface ReminderOffset {
  minutes: number;
  channel: ReminderChannel;
}

/**
 * Reminders for classes, exams or events (CAL-05, design §9.9): up to 5 times before the start,
 * each with a channel. `user_id` null is the organisation's default (owners and admins set it);
 * a person's own rule replaces it for them, and an empty list switches that kind off for them.
 */
@Entity('reminder_rules')
@Index('UQ_reminder_rules_org_default', ['organization_id', 'target'], { unique: true, where: '"user_id" IS NULL' })
@Index('UQ_reminder_rules_user', ['organization_id', 'user_id', 'target'], { unique: true, where: '"user_id" IS NOT NULL' })
@Check('CHK_reminder_rules_target', `"target" IN ('CLASS', 'EXAM', 'EVENT')`)
export class ReminderRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_reminder_rules_user' })
  user?: UserEntity | null;

  @Column({ name: 'target', type: 'varchar', length: 10 })
  target: ReminderTargetEnum;

  @Column({ name: 'offsets', type: 'jsonb' })
  offsets: ReminderOffset[];

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
