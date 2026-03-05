import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamQuestionEntity } from './entities/exam-question.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { ExamEntity } from './entities/exam.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { StudentExamSubmissionEntity, StudentExamAnswerEntity } from './entities/student-exam-answer.entity';
import { StudentExamController } from './student-exam.controller';
import { StudentExamService } from './student-exam.service';
import { SmsModule } from 'src/sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamQuestionEntity,
      ExamEntity,
      UserEntity,
      ClassEntity,
      StudentExamSubmissionEntity,
      StudentExamAnswerEntity,
    ]),
    SmsModule,
  ],
  controllers: [ExamController, StudentExamController],
  providers: [ExamService, StudentExamService],
  exports: [ExamService, StudentExamService],
})
export class ExamModule {}
