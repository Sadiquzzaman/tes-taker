import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/config/redis.module';
import { UserModule } from 'src/user/user.module';
import { EmailModule } from 'src/email/email.module';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassTeacherEntity } from 'src/classes/entities/class-teacher.entity';
import { EnrolmentEntity } from 'src/academics/entities/enrolment.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationTeacherSubjectEntity } from './entities/organization-teacher-subject.entity';
import { OrganizationInvitationEntity } from './entities/organization-invitation.entity';
import { OrgSettingsEntity } from './entities/org-settings.entity';
import { OrganizationsService } from './organization.service';
import { OrganizationAccessService } from './organization-access.service';
import { UserContextService } from './user-context.service';
import { OrganizationController } from './organization.controller';
import { OrganizationAdminController } from './organization-admin.controller';
import { OrganizationContextGuard } from './guards/organization-context.guard';
import { SoloOrganizationService } from './solo-organization.service';
import { OrgSettingsService } from './org-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrganizationMemberEntity,
      OrganizationTeacherSubjectEntity,
      OrganizationInvitationEntity,
      OrgSettingsEntity,
      ClassEntity,
      ClassTeacherEntity,
      EnrolmentEntity,
      ClassSubjectEntity,
      ExamEntity,
      SubjectEntity,
      UserEntity,
    ]),
    RedisModule,
    UserModule,
    EmailModule,
  ],
  controllers: [OrganizationAdminController, OrganizationController],
  providers: [
    OrganizationsService,
    OrganizationAccessService,
    UserContextService,
    SoloOrganizationService,
    OrgSettingsService,
    OrganizationContextGuard,
  ],
  // Export TypeOrmModule so importing modules (ClassModule, ExamModule) can resolve
  // OrganizationContextGuard's OrganizationMember/Organization repositories.
  exports: [
    TypeOrmModule,
    OrganizationsService,
    OrganizationAccessService,
    UserContextService,
    SoloOrganizationService,
    OrgSettingsService,
    OrganizationContextGuard,
  ],
})
export class OrganizationsModule {}
