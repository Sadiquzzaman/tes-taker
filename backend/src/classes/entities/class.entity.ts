import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { CustomBaseEntity } from 'src/common/common-entities/custom-base.enity';
import { IsNotEmpty, MaxLength } from 'class-validator';
import { UserEntity } from 'src/user/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

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

  @ManyToMany(() => UserEntity)
  @JoinTable({
    name: 'class_students',
    joinColumn: { name: 'class_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'student_id', referencedColumnName: 'id' },
  })
  students: UserEntity[];
}
