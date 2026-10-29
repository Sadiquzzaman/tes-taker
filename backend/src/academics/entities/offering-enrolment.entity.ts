import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CourseOfferingEntity } from './course-offering.entity';

export enum OfferingEnrolmentStatusEnum {
  ACTIVE = 'ACTIVE',
  DROPPED = 'DROPPED',
}

/** The students of a SELECTED subject class (FND-19); WHOLE_SECTION offerings do not use it. */
@Entity('offering_enrolments')
@Index(['offering_id', 'student_id'], { unique: true })
@Index(['student_id'])
export class OfferingEnrolmentEntity extends CustomBaseEntity {
  @ApiProperty()
  @Column({ name: 'organization_id', type: 'uuid' })
  organization_id: string;

  @ApiProperty()
  @Column({ name: 'offering_id', type: 'uuid' })
  offering_id: string;

  @ManyToOne(() => CourseOfferingEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id' })
  offering: CourseOfferingEntity;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  student_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity;

  @ApiProperty({ enum: OfferingEnrolmentStatusEnum })
  @Column({ name: 'status', type: 'varchar', length: 20, default: OfferingEnrolmentStatusEnum.ACTIVE })
  status: OfferingEnrolmentStatusEnum;
}
