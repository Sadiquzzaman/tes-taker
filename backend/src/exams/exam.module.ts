import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamQuestionEntity } from './entities/exam-question.entity';
import { ExamQuestionSectionEntity } from './entities/exam-question-section.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { ExamEntity } from './entities/exam.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassStudentEntity } from 'src/classes/entities/class-student.entity';
import { StudentExamSubmissionEntity, StudentExamAnswerEntity } from './entities/student-exam-answer.entity';
import { StudentExamController } from './student-exam.controller';
import { StudentExamService } from './student-exam.service';
import { SmsModule } from 'src/sms/sms.module';
import { SubjectModule } from 'src/subjects/subject.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamQuestionEntity,
      ExamQuestionSectionEntity,
      ExamEntity,
      UserEntity,
      ClassEntity,
      ClassStudentEntity,
      StudentExamSubmissionEntity,
      StudentExamAnswerEntity,
    ]),
    SmsModule,
    SubjectModule,
  ],
  controllers: [ExamController, StudentExamController],
  providers: [ExamService, StudentExamService],
  exports: [ExamService, StudentExamService],
})
export class ExamModule {}
