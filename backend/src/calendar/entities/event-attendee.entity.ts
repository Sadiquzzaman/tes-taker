import { ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { EventEntity } from './event.entity';

/** Who an event is for (CAL-03): a section (its students), or one person (a teacher or student). */
@Entity('event_attendees')
@Index('IDX_event_attendees_event', ['event_id'])
@Index('IDX_event_attendees_section', ['section_id'])
@Index('IDX_event_attendees_user', ['user_id'])
@Check('CHK_event_attendees_one', `("section_id" IS NULL) <> ("user_id" IS NULL)`)
export class EventAttendeeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  event_id: string;

  @ManyToOne(() => EventEntity, (event) => event.attendees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id', foreignKeyConstraintName: 'FK_event_attendees_event' })
  event?: EventEntity;

  @ApiPropertyOptional()
  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  section_id: string | null;

  @ManyToOne(() => SectionEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_event_attendees_section' })
  section?: SectionEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_event_attendees_user' })
  user?: UserEntity | null;
}
