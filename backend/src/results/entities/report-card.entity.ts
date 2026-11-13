import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { TermEntity } from 'src/academics/entities/term.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

/**
 * A student's report card (PRF-09) for a term (or the whole session) in one section, in Bangla or
 * English: the scores frozen when it was made, with the teacher's and principal's remarks. Made
 * again after a change, it is a new version; earlier versions are kept.
 */
@Entity('report_cards')
// (student, section, term or none, version): an expression index, made by the migration.
@Index('UQ_report_cards_version', { synchronize: false })
@Index('IDX_report_cards_section', ['organization_id', 'section_id', 'term_id'])
@Index('UQ_report_cards_share_token', ['share_token_hash'], { unique: true, where: '"share_token_hash" IS NOT NULL' })
@Check('CHK_report_cards_locale', `"locale" IN ('bn', 'en')`)
export class ReportCardEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_report_cards_org' })
  organization?: OrganizationEntity;

  @ApiProperty()
  @Column({ name: 'session_id', type: 'uuid' })
  session_id: string;

  @ManyToOne(() => AcademicSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', foreignKeyConstraintName: 'FK_report_cards_session' })
  session?: AcademicSessionEntity;

  @ApiPropertyOptional({ description: 'null = the whole session (or a removed term)' })
  @Column({ name: 'term_id', type: 'uuid', nullable: true })
  term_id: string | null;

  @ManyToOne(() => TermEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'term_id', foreignKeyConstraintName: 'FK_report_cards_term' })
  term?: TermEntity | null;

  @ApiProperty()
  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_report_cards_section' })
  section?: SectionEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_report_cards_student' })
  student?: UserEntity;

  @ApiProperty({ example: 1 })
  @Column({ name: 'version', type: 'smallint', default: 1 })
  version: number;

  @ApiProperty({ enum: ['bn', 'en'] })
  @Column({ name: 'locale', type: 'varchar', length: 5 })
  locale: 'bn' | 'en';

  @ApiPropertyOptional()
  @Column({ name: 'teacher_remark', type: 'varchar', length: 500, nullable: true })
  teacher_remark: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'principal_remark', type: 'varchar', length: 500, nullable: true })
  principal_remark: string | null;

  @ApiProperty({ description: 'The scores as they were when the card was made' })
  @Column({ name: 'scores_snapshot', type: 'jsonb' })
  scores_snapshot: Record<string, unknown>;

  @Column({ name: 'generated_by', type: 'uuid', nullable: true })
  generated_by: string | null;

  @CreateDateColumn({ name: 'generated_at', type: 'timestamptz' })
  generated_at: Date;

  /** SHA-256 of the guardian link's token; the token itself is never stored. */
  @Column({ name: 'share_token_hash', type: 'varchar', length: 128, nullable: true })
  share_token_hash: string | null;

  @Column({ name: 'share_expires_at', type: 'timestamptz', nullable: true })
  share_expires_at: Date | null;

  @Column({ name: 'shared_at', type: 'timestamptz', nullable: true })
  shared_at: Date | null;

  @Column({ name: 'shared_by', type: 'uuid', nullable: true })
  shared_by: string | null;
}
