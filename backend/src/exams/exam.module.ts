import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamQuestionEntity } from './entities/exam-question.entity';
import { ExamQuestionSectionEntity } from './entities/exam-question-section.entity';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { ExamEntity } from './entities/exam.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { AcademicSessionEntity } from 'src/academics/entities/academic-session.entity';
import { CourseOfferingEntity } from 'src/academics/entities/course-offering.entity';
import { EnrolmentEntity } from 'src/academics/entities/enrolment.entity';
import { OfferingTeacherEntity } from 'src/academics/entities/offering-teacher.entity';
import { StudentExamSubmissionEntity, StudentExamAnswerEntity } from './entities/student-exam-answer.entity';
import { StudentExamController } from './student-exam.controller';
import { StudentExamService } from './student-exam.service';
import { ExamGradingController } from './exam-grading.controller';
import { SubjectModule } from 'src/subjects/subject.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { ClassModule } from 'src/classes/class.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { RedisModule } from 'src/config/redis.module';
import { ExamPaperCacheService } from './exam-paper-cache.service';
import { PerformanceModule } from 'src/performance/performance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamQuestionEntity,
      ExamQuestionSectionEntity,
      ExamEntity,
      UserEntity,
      ClassEntity,
      EnrolmentEntity,
      // Read only: subject classes, their teachers and sessions (tests per subject class, closed sessions).
      CourseOfferingEntity,
      OfferingTeacherEntity,
      AcademicSessionEntity,
      StudentExamSubmissionEntity,
      StudentExamAnswerEntity,
    ]),
    SubjectModule,
    SubscriptionModule,
    ClassModule,
    OrganizationsModule,
    RedisModule,
    // Grades next to marks (FND-11).
    PerformanceModule,
  ],
  controllers: [ExamController, StudentExamController, ExamGradingController],
  providers: [ExamService, StudentExamService, ExamPaperCacheService],
  exports: [ExamService, StudentExamService, ExamPaperCacheService],
})
export class ExamModule {}
