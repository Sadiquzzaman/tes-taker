import { Column, Entity, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { ClassEntity } from './class.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ClassStudentStatusEnum {
  INVITED = 'INVITED', // Non-onboarded student, invitation sent
  PENDING = 'PENDING', // Onboarded student, waiting teacher approval
  JOINED = 'JOINED', // Approved student
}

@Entity('class_students')
@Unique(['class_id', 'student_id'])
@Unique(['class_id', 'invitation_token'])
export class ClassStudentEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Class ID' })
  @Column({ name: 'class_id', type: 'uuid' })
  @Index()
  class_id: string;

  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiPropertyOptional({ description: 'Student ID (null for invited non-onboarded students)' })
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  @Index()
  student_id: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: UserEntity | null;

  @ApiProperty({ description: 'Student status in class', enum: ClassStudentStatusEnum })
  @Column({
    name: 'status',
    type: 'enum',
    enum: ClassStudentStatusEnum,
    default: ClassStudentStatusEnum.INVITED,
  })
  status: ClassStudentStatusEnum;

  @ApiPropertyOptional({ description: 'Email of invited student (for non-onboarded)' })
  @Column({ name: 'invited_email', type: 'varchar', length: 100, nullable: true })
  invited_email: string | null;

  @ApiPropertyOptional({ description: 'Phone of invited student (for non-onboarded)' })
  @Column({ name: 'invited_phone', type: 'varchar', length: 15, nullable: true })
  invited_phone: string | null;

  @ApiPropertyOptional({ description: 'Unique invitation token for registration link' })
  @Column({ name: 'invitation_token', type: 'varchar', length: 100, nullable: true, unique: true })
  @Index()
  invitation_token: string | null;

  @ApiPropertyOptional({ description: 'When the student was invited' })
  @Column({ name: 'invited_at', type: 'timestamp', nullable: true })
  invited_at: Date | null;

  @ApiPropertyOptional({ description: 'When the student joined (registered)' })
  @Column({ name: 'joined_at', type: 'timestamp', nullable: true })
  joined_at: Date | null;

  @ApiPropertyOptional({ description: 'When the student was approved by teacher' })
  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approved_at: Date | null;

  @ApiPropertyOptional({ description: 'ID of teacher who approved the student' })
  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approved_by: string | null;
}
