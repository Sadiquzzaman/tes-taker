import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

/** A teacher's own folder in the resource library (RES-03), one level; deleting keeps the row. */
@Entity('resource_folders')
@Index('IDX_resource_folders_owner', ['organization_id', 'owner_id'])
export class ResourceFolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_resource_folders_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'owner_id', type: 'uuid' })
  owner_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'FK_resource_folders_owner' })
  owner?: UserEntity;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
