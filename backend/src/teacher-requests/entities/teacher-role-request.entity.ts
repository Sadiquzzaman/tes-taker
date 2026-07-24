import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { TeacherRequestStatusEnum } from '../enums/teacher-request-status.enum';

@Entity('teacher_role_requests')
export class TeacherRoleRequestEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Requesting student user id' })
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ApiProperty({ enum: TeacherRequestStatusEnum })
  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: TeacherRequestStatusEnum,
    default: TeacherRequestStatusEnum.PENDING,
  })
  status: TeacherRequestStatusEnum;

  @ApiPropertyOptional({ description: 'Admin who reviewed the request' })
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @ApiPropertyOptional({ description: 'Optional admin note' })
  @Column({ name: 'note', type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
