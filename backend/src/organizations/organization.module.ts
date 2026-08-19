import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/config/redis.module';
import { UserModule } from 'src/user/user.module';
import { EmailModule } from 'src/email/email.module';
import { SmsModule } from 'src/sms/sms.module';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassTeacherEntity } from 'src/classes/entities/class-teacher.entity';
import { ClassStudentEntity } from 'src/classes/entities/class-student.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { ClassSubjectTeacherEntity } from 'src/classes/entities/class-subject-teacher.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationTeacherSubjectEntity } from './entities/organization-teacher-subject.entity';
import { OrganizationInvitationEntity } from './entities/organization-invitation.entity';
import { OrganizationsService } from './organization.service';
import { OrganizationAccessService } from './organization-access.service';
import { UserContextService } from './user-context.service';
import { OrganizationController } from './organization.controller';
import { OrganizationAdminController } from './organization-admin.controller';
import { OrganizationContextGuard } from './guards/organization-context.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrganizationMemberEntity,
      OrganizationTeacherSubjectEntity,
      OrganizationInvitationEntity,
      ClassEntity,
      ClassTeacherEntity,
      ClassStudentEntity,
      ClassSubjectEntity,
      ClassSubjectTeacherEntity,
      ExamEntity,
      SubjectEntity,
      UserEntity,
    ]),
    RedisModule,
    UserModule,
    EmailModule,
    SmsModule,
  ],
  controllers: [OrganizationAdminController, OrganizationController],
  providers: [
    OrganizationsService,
    OrganizationAccessService,
    UserContextService,
    OrganizationContextGuard,
  ],
  // Export TypeOrmModule so importing modules (ClassModule, ExamModule) can resolve
  // OrganizationContextGuard's OrganizationMember/Organization repositories.
  exports: [
    TypeOrmModule,
    OrganizationsService,
    OrganizationAccessService,
    UserContextService,
    OrganizationContextGuard,
  ],
})
export class OrganizationsModule {}
