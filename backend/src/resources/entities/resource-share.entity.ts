import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { ResourceEntity } from './resource.entity';

/** A resource shared with a subject class (section + subject): its students see it (RES-04). */
@Entity('resource_shares')
@Index('IDX_resource_shares_offering', ['offering_id'])
export class ResourceShareEntity {
  @PrimaryColumn({ name: 'resource_id', type: 'uuid' })
  resource_id: string;

  @ManyToOne(() => ResourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id', foreignKeyConstraintName: 'FK_resource_shares_resource' })
  resource?: ResourceEntity;

  @PrimaryColumn({ name: 'offering_id', type: 'uuid' })
  offering_id: string;

  @ManyToOne(() => CourseOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id', foreignKeyConstraintName: 'FK_resource_shares_offering' })
  offering?: CourseOfferingEntity;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
