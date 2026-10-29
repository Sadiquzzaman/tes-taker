import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';
import { UserEntity } from 'src/user/entities/user.entity';

export enum FeatureRequestStatusEnum {
  OPEN = 'OPEN',
  HANDLED = 'HANDLED',
}

/**
 * "Request this feature" from the More features page (FND-08). Platform admins see the list;
 * the SMS/email notification arrives with the outbox (P2-08).
 */
@Entity('feature_requests')
@Index(['status', 'created_at'])
export class FeatureRequestEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty({ description: 'Who asked' })
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ApiProperty({ description: 'Feature key from the catalog' })
  @Column({ name: 'feature_key', type: 'varchar', length: 80 })
  feature_key: string;

  @ApiPropertyOptional()
  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @ApiProperty({ enum: FeatureRequestStatusEnum })
  @Column({ name: 'status', type: 'enum', enum: FeatureRequestStatusEnum, default: FeatureRequestStatusEnum.OPEN })
  status: FeatureRequestStatusEnum;

  @ApiPropertyOptional()
  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handled_at: Date | null;
}
