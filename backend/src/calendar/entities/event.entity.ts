import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, OneToMany } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { EventAttendeeEntity } from './event-attendee.entity';

/** What an event is (CAL-03). Online and offline exams of their own epics show on the calendar from their own tables. */
export enum EventTypeEnum {
  EXAM = 'EXAM',
  MEETING = 'MEETING',
  PARENT_MEETING = 'PARENT_MEETING',
  ACTIVITY = 'ACTIVITY',
  OTHER = 'OTHER',
}

/** An event is SCHEDULED, or CANCELLED (kept, never deleted). */
export enum EventStatusEnum {
  SCHEDULED = 'SCHEDULED',
  CANCELLED = 'CANCELLED',
}

/**
 * A calendar event (CAL-03, design §9.9): an exam, meeting, parent meeting or activity with a
 * time, place and attendees (`event_attendees`: sections, people, or the whole organisation).
 * Cancelling keeps the row (status CANCELLED, who, when).
 */
@Entity('events')
@Index('IDX_events_org_starts', ['organization_id', 'starts_at'])
@Check('CHK_events_times', `"ends_at" > "starts_at"`)
export class EventEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty({ enum: EventTypeEnum })
  @Column({ name: 'type', type: 'enum', enum: EventTypeEnum, enumName: 'event_type' })
  type: EventTypeEnum;

  @ApiProperty({ example: 'Parent meeting, Class 8' })
  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @ApiPropertyOptional()
  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({ name: 'starts_at', type: 'timestamptz' })
  starts_at: Date;

  @ApiProperty()
  @Column({ name: 'ends_at', type: 'timestamptz' })
  ends_at: Date;

  @ApiPropertyOptional({ example: 'Main hall' })
  @Column({ name: 'place', type: 'varchar', length: 120, nullable: true })
  place: string | null;

  @ApiProperty({ description: 'Everyone in the organisation attends' })
  @Column({ name: 'whole_org', type: 'boolean', default: false })
  whole_org: boolean;

  @ApiProperty({ enum: EventStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: EventStatusEnum, enumName: 'event_status', default: EventStatusEnum.SCHEDULED })
  status: EventStatusEnum;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelled_by: string | null;

  @OneToMany(() => EventAttendeeEntity, (attendee) => attendee.event)
  attendees?: EventAttendeeEntity[];
}
