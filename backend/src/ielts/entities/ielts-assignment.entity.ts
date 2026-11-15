import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SectionEntity } from 'src/academics/entities/section.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { IeltsTestEntity } from './ielts-test.entity';

/** A published IELTS test opened for a batch (section) between two times (IEL-08). Soft-deleted. */
@Entity('ielts_assignments')
@Index('IDX_ielts_assignments_section', ['section_id', 'opens_at'])
@Index('IDX_ielts_assignments_test', ['test_id'])
@Check('CHK_ielts_assignments_window', `"closes_at" > "opens_at"`)
export class IeltsAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_assignments_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'test_id', type: 'uuid' })
  test_id: string;

  @ManyToOne(() => IeltsTestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id', foreignKeyConstraintName: 'FK_ielts_assignments_test' })
  test?: IeltsTestEntity;

  @Column({ name: 'section_id', type: 'uuid' })
  section_id: string;

  @ManyToOne(() => SectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'section_id', foreignKeyConstraintName: 'FK_ielts_assignments_section' })
  section?: SectionEntity;

  @Column({ name: 'opens_at', type: 'timestamptz' })
  opens_at: Date;

  @Column({ name: 'closes_at', type: 'timestamptz' })
  closes_at: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  created_by: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
