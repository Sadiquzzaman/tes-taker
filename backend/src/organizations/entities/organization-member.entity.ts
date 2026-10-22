import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationEntity } from './organization.entity';
import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

@Entity('organization_members')
@Unique(['organization_id', 'user_id'])
export class OrganizationMemberEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ApiProperty()
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ApiProperty({ enum: OrganizationMemberRoleEnum })
  @Column({
    name: 'role',
    type: 'enum',
    enum: OrganizationMemberRoleEnum,
  })
  role: OrganizationMemberRoleEnum;

  @ApiProperty({ required: false, nullable: true })
  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removed_at: Date | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ name: 'removed_by', type: 'uuid', nullable: true })
  removed_by: string | null;
}
