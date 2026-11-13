import { ApiProperty } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

/**
 * How much each part counts in a class's score for a session (PRF-01), in whole percent adding up
 * to 100. A class without a row uses the default (`DEFAULT_WEIGHTS`, 50/20/20/10).
 */
@Entity('score_weights')
@Index('UQ_score_weights_class', ['session_id', 'class_id'], { unique: true })
@Index('IDX_score_weights_org', ['organization_id'])
@Check(
  'CHK_score_weights_range',
  '"exams_pct" BETWEEN 0 AND 100 AND "homework_pct" BETWEEN 0 AND 100 AND "attendance_pct" BETWEEN 0 AND 100 AND "behaviour_pct" BETWEEN 0 AND 100',
)
@Check('CHK_score_weights_sum', '"exams_pct" + "homework_pct" + "attendance_pct" + "behaviour_pct" = 100')
export class ScoreWeightEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_score_weights_org' })
  organization?: OrganizationEntity;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_score_weights_session' })
  session?: AcademicSessionEntity;

  @ApiProperty()
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id', foreignKeyConstraintName: 'FK_score_weights_class' })
  class?: ClassEntity;

  @ApiProperty({ example: 50 })
  @Column({ name: 'exams_pct', type: 'smallint' })
  exams_pct: number;

  @ApiProperty({ example: 20 })
  @Column({ name: 'homework_pct', type: 'smallint' })
  homework_pct: number;

  @ApiProperty({ example: 20 })
  @Column({ name: 'attendance_pct', type: 'smallint' })
  attendance_pct: number;

  @ApiProperty({ example: 10 })
  @Column({ name: 'behaviour_pct', type: 'smallint' })
  behaviour_pct: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;
}
