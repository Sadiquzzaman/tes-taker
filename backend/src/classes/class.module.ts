import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from './entities/class.entity';
import { ClassStudentEntity } from './entities/class-student.entity';
import { ClassTeacherEntity } from './entities/class-teacher.entity';
import { ClassSubjectEntity } from './entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from './entities/class-subject-teacher.entity';
import { ClassService } from './class.service';
import { ClassController } from './class.controller';
import { StudentClassController } from './student-class.controller';
import { UserEntity } from 'src/user/entities/user.entity';
import { EmailModule } from 'src/email/email.module';
import { SmsModule } from 'src/sms/sms.module';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClassEntity,
      ClassStudentEntity,
      ClassTeacherEntity,
      ClassSubjectEntity,
      ClassSubjectTeacherEntity,
      UserEntity,
      ExamEntity,
      SubjectEntity,
    ]),
    EmailModule,
    SmsModule,
    OrganizationsModule,
  ],
  controllers: [ClassController, StudentClassController],
  providers: [ClassService],
  exports: [ClassService],
})
export class ClassModule {}
