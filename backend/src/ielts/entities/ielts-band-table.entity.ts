import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { BandRow } from '../bands';
import { IeltsModuleEnum, IeltsTestTypeEnum } from './ielts-profile.entity';

/**
 * Raw score (out of 40) → band for Listening and Reading (IEL-04, IEL-05). Rows without an
 * organisation are the platform defaults; a centre that edits a table gets its own copy.
 * Reading has an Academic and a General Training table; Listening has one (no test type).
 */
@Entity('ielts_band_tables')
@Index('UQ_ielts_band_tables_scope', { synchronize: false })
@Check('CHK_ielts_band_tables_module', `("module" = 'LISTENING' AND "test_type" IS NULL) OR ("module" = 'READING' AND "test_type" IN ('ACADEMIC', 'GENERAL'))`)
export class IeltsBandTableEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null = the platform default. */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_ielts_band_tables_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'module', type: 'varchar', length: 10 })
  module: IeltsModuleEnum.LISTENING | IeltsModuleEnum.READING;

  @Column({ name: 'test_type', type: 'varchar', length: 10, nullable: true })
  test_type: IeltsTestTypeEnum | null;

  /** Highest raw score first, e.g. [{ min_raw: 39, band: 9 }, …, { min_raw: 0, band: 0 }]. */
  @Column({ name: 'rows', type: 'jsonb' })
  rows: BandRow[];

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updated_by: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;
}
