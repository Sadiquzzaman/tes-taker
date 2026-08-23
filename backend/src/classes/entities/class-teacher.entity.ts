import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { UserEntity } from 'src/user/entities/user.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { ClassEntity } from './class.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('class_teachers')
@Index('UQ_class_teachers_class_teacher_subject', ['class_id', 'teacher_id', 'subject_id'], {
  unique: true,
})
export class ClassTeacherEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiProperty()
  @Index()
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @ApiPropertyOptional()
  @Index()
  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subject_id: string | null;

  @ManyToOne(() => SubjectEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity | null;
}
