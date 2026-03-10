import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity } from './entities/class-student.entity';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { UserEntity } from 'src/user/entities/user.entity';
import { EmailModule } from 'src/email/email.module';
import { SmsModule } from 'src/sms/sms.module';
import { StudentExamSubmissionEntity } from 'src/exams/entities/student-exam-answer.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassEntity,
      ClassStudentEntity,
      UserEntity,
      StudentExamSubmissionEntity,
      ExamEntity,
    ]),
    EmailModule,
    SmsModule,
  ],
  controllers: [ClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
