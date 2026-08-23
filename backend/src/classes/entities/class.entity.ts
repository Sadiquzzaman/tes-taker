import { Column, Entity, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { IsNotEmpty, MaxLength } from 'class-validator';
import { UserEntity } from 'src/user/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStudentEntity } from './class-student.entity';
import { ClassTeacherEntity } from './class-teacher.entity';
import { ClassSubjectEntity } from './class-subject.entity';
import { ClassKindEnum } from '../enums/class-kind.enum';
import { OrganizationEntity } from 'src/organizations/entities/organization.entity';

@Entity('classes')
export class ClassEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Name of the class', example: 'Mathematics 101' })
  @Column({ name: 'class_name', type: 'varchar', length: 100 })
  @IsNotEmpty()
  @MaxLength(100)
  class_name: string;

  @ApiProperty({ description: 'Description of the class', example: 'Introduction to calculus' })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  /** Human-readable class id, e.g. CLS-83KD2 */
  @ApiPropertyOptional({ example: 'CLS-83KD2' })
  @Column({ name: 'public_id', type: 'varchar', length: 32, nullable: true })
  @Index({ unique: true })
  public_id: string | null;

  @ApiProperty({ description: 'Primary creator/owner of the class' })
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @ApiPropertyOptional({ description: 'Organization this class belongs to (null = individual personal)' })
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organization_id: string | null;

  @ManyToOne(() => OrganizationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity | null;

  @ApiPropertyOptional({ enum: ClassKindEnum })
  @Column({
    name: 'class_kind',
    type: 'enum',
    enum: ClassKindEnum,
    default: ClassKindEnum.PERSONAL,
  })
  class_kind: ClassKindEnum;

  @OneToMany(() => ClassStudentEntity, (classStudent) => classStudent.class, { cascade: true })
  classStudents: ClassStudentEntity[];

  @OneToMany(() => ClassTeacherEntity, (ct) => ct.class, { cascade: true })
  classTeachers: ClassTeacherEntity[];

  @OneToMany(() => ClassSubjectEntity, (cs) => cs.class, { cascade: true })
  classSubjects: ClassSubjectEntity[];

  @ApiPropertyOptional({
    description: 'Number of exams already conducted for this class (exam_end_time in the past)',
  })
  total_test_taken?: number;
  @ApiPropertyOptional({ description: 'Most recent conducted exam end time for this class' })
  last_test_taken_date?: Date | null;
}
