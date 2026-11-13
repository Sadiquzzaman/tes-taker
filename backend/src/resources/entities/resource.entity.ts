import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FileObjectEntity } from 'src/files/entities/file-object.entity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ResourceFolderEntity } from './resource-folder.entity';

export enum ResourceTypeEnum {
  /** An upload of the files module (purpose RESOURCE): PDF, Word, slides, images, audio. */
  FILE = 'FILE',
  /** A class recording on our storage (RES-02); reserved, not uploadable yet. */
  VIDEO = 'VIDEO',
  /** YouTube, Google Drive or any web address. */
  LINK = 'LINK',
}

/**
 * A resource in the library (RES-01, RES-03): a file or a link with title, description, subject,
 * folder and tags, shared with subject classes. Archived resources are hidden from students but
 * kept; deleting keeps the row (deleted_at).
 */
@Entity('resources')
@Index('IDX_resources_org_created', ['organization_id', 'created_at'])
@Index('IDX_resources_owner', ['organization_id', 'created_by'])
@Check('CHK_resources_type', `"type" IN ('FILE', 'VIDEO', 'LINK')`)
@Check('CHK_resources_source', `("type" = 'LINK' AND "url" IS NOT NULL) OR ("type" <> 'LINK' AND "file_id" IS NOT NULL)`)
export class ResourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'FK_resources_organization' })
  organization?: OrganizationEntity;

  @Column({ name: 'type', type: 'varchar', length: 10 })
  type: ResourceTypeEnum;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subject_id: string | null;

  @ManyToOne(() => SubjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subject_id', foreignKeyConstraintName: 'FK_resources_subject' })
  subject?: SubjectEntity | null;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folder_id: string | null;

  @ManyToOne(() => ResourceFolderEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'folder_id', foreignKeyConstraintName: 'FK_resources_folder' })
  folder?: ResourceFolderEntity | null;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  file_id: string | null;

  @ManyToOne(() => FileObjectEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'file_id', foreignKeyConstraintName: 'FK_resources_file' })
  file?: FileObjectEntity | null;

  @Column({ name: 'url', type: 'varchar', length: 1000, nullable: true })
  url: string | null;

  @Column({ name: 'tags', type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  /** RES-05: when false, students only view it (no download button). */
  @Column({ name: 'download_allowed', type: 'boolean', default: true })
  download_allowed: boolean;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archived_at: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  created_by: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by', foreignKeyConstraintName: 'FK_resources_creator' })
  creator?: UserEntity;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;
}
