import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { ClassEntity } from './class.entity';
import { ClassSubjectTeacherEntity } from './class-subject-teacher.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('class_subjects')
@Unique(['class_id', 'subject_id'])
export class ClassSubjectEntity extends CustomBaseEntity {
  @ApiProperty()
  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => ClassEntity, (c) => c.classSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiProperty()
  @Index()
  @Column({ name: 'subject_id', type: 'uuid' })
  subject_id: string;

  @ManyToOne(() => SubjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subject_id' })
  subject: SubjectEntity;

  @OneToMany(() => ClassSubjectTeacherEntity, (cst) => cst.classSubject, { cascade: true })
  teachers: ClassSubjectTeacherEntity[];
}
