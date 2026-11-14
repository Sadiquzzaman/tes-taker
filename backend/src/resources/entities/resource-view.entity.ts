import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ResourceEntity } from './resource.entity';

/** A student opened a resource (RES-04 "New" badges, RES-06 insights): first and last time, how often. */
@Entity('resource_views')
export class ResourceViewEntity {
  @PrimaryColumn({ name: 'resource_id', type: 'uuid' })
  resource_id: string;

  @ManyToOne(() => ResourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id', foreignKeyConstraintName: 'FK_resource_views_resource' })
  resource?: ResourceEntity;

  @PrimaryColumn({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'FK_resource_views_student' })
  student?: UserEntity;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @Column({ name: 'first_opened_at', type: 'timestamptz', default: () => 'now()' })
  first_opened_at: Date;

  @Column({ name: 'last_opened_at', type: 'timestamptz', default: () => 'now()' })
  last_opened_at: Date;

  @Column({ name: 'opens', type: 'int', default: 1 })
  opens: number;

  /** How much of a video was watched (RES-06); comes with video upload. */
  @Column({ name: 'watch_pct', type: 'smallint', nullable: true })
  watch_pct: number | null;
}
