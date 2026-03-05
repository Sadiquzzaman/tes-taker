import { Column, Entity, OneToMany, ManyToOne, JoinColumn, ManyToMany, JoinTable } from "typeorm";
import { ExamQuestionEntity } from "./exam-question.entity";
import { CustomBaseEntity } from "src/common/common-entities/custom-base.enity";
import { IsNotEmpty } from "class-validator";
import { ClassEntity } from "src/classes/entities/class.entity";
import { UserEntity } from "src/user/entities/user.entity";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ExamTypeEnum {
  OBJECTIVE = 'OBJECTIVE',
  SUBJECTIVE = 'SUBJECTIVE',
}

@Entity({ name: "exams" })
export class ExamEntity extends CustomBaseEntity {
  @ApiProperty({ description: 'Type of exam', enum: ExamTypeEnum })
  @Column({ name: "exam_type", type: 'enum', enum: ExamTypeEnum, default: ExamTypeEnum.OBJECTIVE })
  @IsNotEmpty()
  exam_type: ExamTypeEnum;

  @ApiProperty({ description: 'Exam start time' })
  @Column({ name: "exam_start_time", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @IsNotEmpty()
  exam_start_time: Date;

  @ApiProperty({ description: 'Exam end time' })
  @Column({ name: "exam_end_time", type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @IsNotEmpty()
  exam_end_time: Date;

  @ApiPropertyOptional({ description: 'Whether negative marking is enabled (for objective exams)' })
  @Column({ name: "is_negative_marking", type: 'boolean', default: false })
  is_negative_marking: boolean;

  @ApiPropertyOptional({ description: 'Negative mark value per wrong answer' })
  @Column({ name: "negative_mark_value", type: 'float', nullable: true })
  negative_mark_value: number;

  @ApiProperty({ description: 'Subject of the exam' })
  @Column({ name: "subject", type: 'varchar', length: 100 })
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ description: 'Class ID this exam is assigned to' })
  @Column({ name: "class_id", type: 'uuid', nullable: true })
  class_id: string;

  @ManyToOne(() => ClassEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  class: ClassEntity;

  @ApiPropertyOptional({ description: 'List of students excluded from this exam' })
  @ManyToMany(() => UserEntity)
  @JoinTable({
    name: 'exam_excluded_students',
    joinColumn: { name: 'exam_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'student_id', referencedColumnName: 'id' },
  })
  excluded_students: UserEntity[];

  @OneToMany(() => ExamQuestionEntity, (question) => question.exam, {
    cascade: true,
  })
  questions: ExamQuestionEntity[];
}
