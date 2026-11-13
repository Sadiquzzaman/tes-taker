import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { TermEntity } from 'src/academics/entities/term.entity';

/** One part of a paper exam, e.g. MCQ out of 30 (PRF-03). */
export interface OfflineExamPart {
  name: string;
  marks: number;
}

/**
 * An exam taken on paper (P7-01, PRF-03): for one subject class, on a date, out of total marks,
 * optionally in parts whose marks add up to the total, optionally in a term. Students see their
 * marks once `published_at` is set. Never deleted: removing it sets `removed_at`/`removed_by`.
 */
@Entity('offline_exams')
@Index('IDX_offline_exams_org_offering', ['organization_id', 'offering_id', 'exam_date'])
@Index('IDX_offline_exams_org_session', ['organization_id', 'session_id'])
@Check('CHK_offline_exams_total', '"total_marks" > 0')
export class OfflineExamEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_offline_exams_session' })
  session?: AcademicSessionEntity;

  @ApiPropertyOptional()
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  term_id: string | null;

  @ManyToOne(() => TermEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_offline_exams_term' })
  term?: TermEntity | null;

  @ApiProperty()
  @Column({ name: 'offering_id', type: 'uuid' })
  offering_id: string;

  @ManyToOne(() => CourseOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id', foreignKeyConstraintName: 'FK_offline_exams_offering' })
  offering?: CourseOfferingEntity;

  @ApiProperty({ example: 'Half-yearly exam' })
  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @ApiProperty({ example: '2026-12-10' })
  @Column({ name: 'exam_date', type: 'date' })
  exam_date: string;

  @ApiProperty({ example: 100 })
  @Column({ name: 'total_marks', type: 'numeric', precision: 6, scale: 2 })
  total_marks: string;

  @ApiPropertyOptional({ description: '[{ name, marks }] adding up to the total' })
  @Column({ name: 'parts', type: 'jsonb', nullable: true })
  parts: OfflineExamPart[] | null;

  @ApiPropertyOptional()
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removed_at: Date | null;

  @Column({ name: 'removed_by', type: 'uuid', nullable: true })
  removed_by: string | null;
}
