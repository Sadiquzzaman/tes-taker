import { Column, Entity, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { IsNotEmpty, MaxLength } from 'class-validator';
import { UserEntity } from 'src/user/entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStudentEntity } from './class-student.entity';

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

  @ApiProperty({ description: 'Teacher ID who created/owns the class' })
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacher_id: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher: UserEntity;

  @ApiPropertyOptional({ description: 'Share token for public class joining' })
  @Column({ name: 'share_token', type: 'varchar', length: 100, nullable: true, unique: true })
  @Index()
  share_token: string | null;

  @OneToMany(() => ClassStudentEntity, (classStudent) => classStudent.class, { cascade: true })
  classStudents: ClassStudentEntity[];

  // Computed properties (not stored in DB, computed in service)
  total_test_taken?: number;
  last_test_taken_date?: Date | null;
}
