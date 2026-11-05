import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * A weekly slot in which a section meets (ATT-16; CAL-01 reuses it for the routine): an ISO day and
 * a start and end time in the organisation's time zone, optionally with a teacher. P3-02 schedules
 * whole-section classes (`offering_id` null). Removing a slot keeps the row (is_active '0',
 * removed_at/by), so class sessions made from it keep their history.
 */
@Entity('routine_slots')
@Index('IDX_routine_slots_section_day', ['section_id', 'day_of_week', 'start_time'])
@Index('IDX_routine_slots_teacher_day', ['teacher_id', 'day_of_week', 'start_time'])
@Index('IDX_routine_slots_organization_session', ['organization_id', 'session_id'])
@Check('CHK_routine_slots_day', `"day_of_week" BETWEEN 1 AND 7`)
@Check('CHK_routine_slots_times', `"end_time" > "start_time"`)
export class RoutineSlotEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_routine_slots_session' })
  session: AcademicSessionEntity;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_routine_slots_section' })
  section: SectionEntity;

  @ApiPropertyOptional({ description: 'null = a whole-section class (P3-02); subject periods come with the routine (P5)' })
  @Column({ name: 'offering_id', type: 'uuid', nullable: true })
  offering_id: string | null;

  @ManyToOne(() => CourseOfferingEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'offering_id', foreignKeyConstraintName: 'FK_routine_slots_offering' })
  offering: CourseOfferingEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacher_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id', foreignKeyConstraintName: 'FK_routine_slots_teacher' })
  teacher: UserEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'room', type: 'varchar', length: 40, nullable: true })
  room: string | null;

  @ApiProperty({ example: 6, description: 'ISO day, 1 = Monday … 7 = Sunday' })
  @Column({ name: 'day_of_week', type: 'smallint' })
  day_of_week: number;

  @ApiProperty({ example: '16:00:00' })
  @Column({ name: 'start_time', type: 'time' })
  start_time: string;

  @ApiProperty({ example: '17:30:00' })
  @Column({ name: 'end_time', type: 'time' })
  end_time: string;

  @ApiPropertyOptional()
  @Column({ name: 'valid_from', type: 'date', nullable: true })
  valid_from: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'valid_to', type: 'date', nullable: true })
  valid_to: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removed_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'removed_by', type: 'uuid', nullable: true })
  removed_by: string | null;
}
