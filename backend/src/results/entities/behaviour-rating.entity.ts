import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { BehaviourCriterionEntity } from './behaviour-criterion.entity';

/**
 * A 1–5 rating of a student on one criterion, in a subject class, on a date (PRF-04), with an
 * optional remark. Rating again the same day replaces it; the term average is what counts.
 */
@Entity('behaviour_ratings')
@Index('UQ_behaviour_ratings_day', ['offering_id', 'student_id', 'criterion_id', 'rated_on'], { unique: true })
@Index('IDX_behaviour_ratings_org_student', ['organization_id', 'student_id', 'rated_on'])
@Check('CHK_behaviour_ratings_rating', '"rating" BETWEEN 1 AND 5')
export class BehaviourRatingEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'offering_id', type: 'uuid' })
  offering_id: string;

  @ManyToOne(() => CourseOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id', foreignKeyConstraintName: 'FK_behaviour_ratings_offering' })
  offering?: CourseOfferingEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_behaviour_ratings_student' })
  student?: UserEntity;

  @ApiProperty()
  @Column({ name: 'criterion_id', type: 'uuid' })
  criterion_id: string;

  @ManyToOne(() => BehaviourCriterionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'criterion_id', foreignKeyConstraintName: 'FK_behaviour_ratings_criterion' })
  criterion?: BehaviourCriterionEntity;

  @ApiProperty({ example: 4 })
  @Column({ name: 'rating', type: 'smallint' })
  rating: number;

  @ApiPropertyOptional()
  @Column({ name: 'remark', type: 'varchar', length: 300, nullable: true })
  remark: string | null;

  @ApiProperty({ example: '2026-11-15' })
  @Column({ name: 'rated_on', type: 'date' })
  rated_on: string;

  @Column({ name: 'rated_by', type: 'uuid', nullable: true })
  rated_by: string | null;

  @Column({ name: 'rated_at', type: 'timestamptz', default: () => 'now()' })
  rated_at: Date;
}
