import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity } from 'src/classes/entities/class-student.entity';
import { StudentExamSubmissionEntity } from 'src/exams/entities/student-exam-answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamEntity,
      ClassEntity,
      ClassStudentEntity,
      StudentExamSubmissionEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
