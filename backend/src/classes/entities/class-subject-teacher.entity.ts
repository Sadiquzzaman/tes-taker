import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassSubjectEntity } from './class-subject.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('class_subject_teachers')
@Unique(['class_subject_id', 'teacher_id'])
export class ClassSubjectTeacherEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index()
  @Column({ name: 'class_subject_id', type: 'uuid' })
  class_subject_id: string;

  @ManyToOne(() => ClassSubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_subject_id' })
  classSubject: ClassSubjectEntity;

  @ApiProperty()
  @Index()
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;
}
