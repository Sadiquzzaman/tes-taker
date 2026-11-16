import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

export enum SimilarityScopeEnum {
  /** One homework: the latest typed answer of each student. */
  HOMEWORK = 'HOMEWORK',
  /** One IELTS opening's Writing: each task's scripts against the same task's. */
  IELTS_WRITING = 'IELTS_WRITING',
}

/** One plagiarism run over a scope (PLG-01). */
@Entity('similarity_checks')
@Index('IDX_similarity_checks_scope', ['organization_id', 'scope_type', 'scope_id', 'ran_at'])
@Check('CHK_similarity_checks_scope', `"scope_type" IN ('HOMEWORK', 'IELTS_WRITING')`)
@Check('CHK_similarity_checks_status', `"status" IN ('DONE')`)
export class SimilarityCheckEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_similarity_checks_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'scope_type', type: 'varchar', length: 20 })
  scope_type: SimilarityScopeEnum;

  @Column({ name: 'scope_id', type: 'uuid' })
  scope_id: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'DONE' })
  status: string;

  /** Texts compared. */
  @Column({ name: 'submissions', type: 'integer', default: 0 })
  submissions: number;

  @Column({ name: 'ran_at', type: 'timestamptz', default: () => 'now()' })
  ran_at: Date;

  /** Null when it ran by itself after the due date. */
  @Column({ name: 'ran_by', type: 'uuid', nullable: true })
  ran_by: string | null;
}
