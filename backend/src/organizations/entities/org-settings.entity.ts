import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from './organization.entity';

/**
 * One row per organisation with its settings (design §9.1). Later epics add their columns
 * (attendance method, weekly off days, guardian SMS switches, ...).
 */
@Entity('org_settings')
export class OrgSettingsEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index({ unique: true })
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ description: 'Sections have a class teacher (FND-02). Default: on for schools, off for solo teachers' })
  @Column({ name: 'class_teacher_enabled', type: 'boolean', default: true })
  class_teacher_enabled: boolean;
}
