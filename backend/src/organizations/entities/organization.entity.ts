import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';

@Entity('organizations')
export class OrganizationEntity extends CustomBaseEntity {
  @ApiProperty({ example: 'ABC School' })
  @Column({ name: 'name', type: 'varchar', length: 200 })
  @Index()
  name: string;

  /** Sequential organization public id, e.g. 100001 */
  @ApiProperty({ example: '100001' })
  @Column({ name: 'public_id', type: 'varchar', length: 32, nullable: true })
  @Index({ unique: true })
  public_id: string | null;

  @ApiProperty({
    description: 'Legacy numeric organization number (starts at 100001)',
    example: 100001,
  })
  @Column({
    name: 'organization_number',
    type: 'bigint',
    unique: true,
    nullable: true,
  })
  @Index()
  organization_number: string | null;

  @ApiProperty({ enum: OrganizationStatusEnum })
  @Column({
    name: 'status',
    type: 'enum',
    enum: OrganizationStatusEnum,
    default: OrganizationStatusEnum.PENDING,
  })
  @Index()
  status: OrganizationStatusEnum;

  @ApiPropertyOptional()
  @Column({ name: 'rejected_reason', type: 'varchar', length: 500, nullable: true })
  rejected_reason: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: UserEntity | null;

  @ApiPropertyOptional()
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;
}
