import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import type { HomeworkEntity } from './homework.entity';

/**
 * Who a homework is for (HW-01): a subject class (`student_id` null = everyone taking it), or chosen
 * students of it (one row each). Students are worked out from the subject class's roster when read,
 * so joining or leaving the class later is reflected.
 */
@Entity('homework_targets')
@Index('IDX_homework_targets_homework', ['homework_id'])
@Index('IDX_homework_targets_offering', ['offering_id'])
export class HomeworkTargetEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'homework_id', type: 'uuid' })
  homework_id: string;

  @ManyToOne('HomeworkEntity', 'targets', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id', foreignKeyConstraintName: 'FK_homework_targets_homework' })
  homework?: HomeworkEntity;

  @ApiProperty({ description: 'The subject class' })
  @Column({ name: 'offering_id', type: 'uuid' })
  offering_id: string;

  @ManyToOne(() => CourseOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id', foreignKeyConstraintName: 'FK_homework_targets_offering' })
  offering?: CourseOfferingEntity;

  @ApiPropertyOptional({ description: 'One chosen student; null = the whole subject class' })
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  student_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_homework_targets_student' })
  student?: UserEntity | null;
}
