import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CourseOfferingEntity } from './course-offering.entity';

/** A teacher of a subject class. All teachers of an offering are equal (owner decision, P2-03). */
@Entity('offering_teachers')
@Index(['offering_id', 'teacher_id'], { unique: true })
@Index(['teacher_id'])
export class OfferingTeacherEntity extends CustomBaseEntity {
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
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;
}
