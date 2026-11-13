import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

/**
 * Something an organisation rates in class (PRF-04), e.g. participation, in English and Bangla.
 * Retired (is_active false) rather than deleted, so earlier ratings keep their meaning.
 */
@Entity('behaviour_criteria')
@Index('IDX_behaviour_criteria_org', ['organization_id', 'is_active'])
export class BehaviourCriterionEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_behaviour_criteria_org' })
  organization?: OrganizationEntity;

  @ApiProperty({ example: 'Participation' })
  @Column({ name: 'name_en', type: 'varchar', length: 80 })
  name_en: string;

  @ApiProperty({ example: 'অংশগ্রহণ' })
  @Column({ name: 'name_bn', type: 'varchar', length: 80 })
  name_bn: string;

  @ApiProperty()
  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sort_order: number;

  @ApiProperty()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retired_at: Date | null;

  @Column({ name: 'retired_by', type: 'uuid', nullable: true })
  retired_by: string | null;
}
