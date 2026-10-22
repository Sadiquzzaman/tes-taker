import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationEntity } from './organization.entity';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';
import { OrganizationInvitationStatusEnum } from '../enums/organization-invitation-status.enum';

@Entity('organization_invitations')
export class OrganizationInvitationEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiPropertyOptional()
  @Index()
  @Column({ name: 'invited_phone', type: 'varchar', length: 20, nullable: true })
  invited_phone: string | null;

  @ApiPropertyOptional()
  @Index()
  @Column({ name: 'invited_email', type: 'varchar', length: 100, nullable: true })
  invited_email: string | null;

  @ApiProperty({ enum: OrganizationMemberRoleEnum })
  @Column({
    name: 'role',
    type: 'enum',
    enum: OrganizationMemberRoleEnum,
  })
  role: OrganizationMemberRoleEnum;

  @ApiProperty()
  @Index()
  @Column({ name: 'invited_by', type: 'uuid' })
  invited_by: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invited_by' })
  inviter: UserEntity;

  @ApiProperty()
  @Index({ unique: true })
  @Column({ name: 'token', type: 'uuid' })
  token: string;

  @ApiProperty({ enum: OrganizationInvitationStatusEnum })
  @Column({
    name: 'status',
    type: 'enum',
    enum: OrganizationInvitationStatusEnum,
    default: OrganizationInvitationStatusEnum.PENDING,
  })
  status: OrganizationInvitationStatusEnum;

  @ApiPropertyOptional()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'accepted_user_id', type: 'uuid', nullable: true })
  accepted_user_id: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  accepted_at: Date | null;
}
