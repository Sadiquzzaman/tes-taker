import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { FilePurposeEnum, FileStatusEnum } from '../file-rules';

/** bigint comes back from PostgreSQL as a string; sizes stay far below 2^53. */
const bigintAsNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Every stored file (FND-15, FND-16, design §8.5). `size_bytes` counts toward the organisation's
 * storage quota while the file is PENDING or READY and not deleted. Files are soft-deleted
 * (`deleted_at`, `deleted_by`); the stored object is kept.
 */
@Entity('file_objects')
@Index('IDX_file_objects_organization_purpose', ['organization_id', 'purpose'])
@Index('IDX_file_objects_status_created', ['status', 'created_at'])
@Index('IDX_file_objects_delete_after', ['delete_after'])
@Index('UQ_file_objects_legacy_key', ['legacy_key'], { unique: true, where: '"legacy_key" IS NOT NULL' })
@Check('CHK_file_objects_status', `"status" IN ('PENDING', 'READY', 'FAILED')`)
export class FileObjectEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity)
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @ApiPropertyOptional({ description: 'Who uploaded it; null for moved legacy files' })
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  owner_id: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner?: UserEntity;

  @ApiProperty({ enum: FilePurposeEnum })
  @Column({ name: 'purpose', type: 'varchar', length: 30 })
  purpose: FilePurposeEnum;

  @ApiProperty({ description: 'Storage key: tmp/{uuid} until processed, then org/{orgId}/{purpose}/{yyyy}/{uuid}.{ext}' })
  @Column({ name: 's3_key', type: 'varchar', length: 400 })
  s3_key: string;

  @ApiProperty()
  @Column({ name: 'mime', type: 'varchar', length: 100 })
  mime: string;

  @ApiPropertyOptional()
  @Column({ name: 'original_name', type: 'varchar', length: 255, nullable: true })
  original_name: string | null;

  @ApiProperty({ description: 'Counts toward the storage quota (the declared size until processed)' })
  @Column({ name: 'size_bytes', type: 'bigint', default: 0, transformer: bigintAsNumber })
  size_bytes: number;

  @ApiPropertyOptional()
  @Column({ name: 'original_size_bytes', type: 'bigint', nullable: true, transformer: bigintAsNumber })
  original_size_bytes: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'width', type: 'int', nullable: true })
  width: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'height', type: 'int', nullable: true })
  height: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'duration_s', type: 'int', nullable: true })
  duration_s: number | null;

  @ApiProperty({ enum: FileStatusEnum })
  @Column({ name: 'status', type: 'varchar', length: 10, default: FileStatusEnum.PENDING })
  status: FileStatusEnum;

  @ApiPropertyOptional({ description: 'M4: the key the file had under the old /uploads storage' })
  @Column({ name: 'legacy_key', type: 'varchar', length: 400, nullable: true })
  legacy_key: string | null;

  @ApiPropertyOptional({ description: 'Retention (selfies, snapshots: +90 days)' })
  @Column({ name: 'delete_after', type: 'timestamptz', nullable: true })
  delete_after: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deleted_by: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deleted_by' })
  deleter?: UserEntity;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}
