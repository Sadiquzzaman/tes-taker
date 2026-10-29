import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from 'src/classes/entities/class.entity';
import { ClassSubjectEntity } from 'src/classes/entities/class-subject.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubjectEntity } from 'src/subjects/entities/subject.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { UserModule } from 'src/user/user.module';
import { AcademicSessionsController } from './academic-sessions.controller';
import { AcademicSessionsService } from './academic-sessions.service';
import { AcademicSessionEntity } from './entities/academic-session.entity';
import { CourseOfferingEntity } from './entities/course-offering.entity';
import { EnrolmentEntity } from './entities/enrolment.entity';
import { OfferingEnrolmentEntity } from './entities/offering-enrolment.entity';
import { OfferingTeacherEntity } from './entities/offering-teacher.entity';
import { SectionEntity } from './entities/section.entity';
import { TermEntity } from './entities/term.entity';
import { EnrolmentsService } from './enrolments.service';
import { LegacyClassSyncSubscriber } from './legacy-class-sync.subscriber';
import { OfferingRosterService } from './offering-roster.service';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';

/**
 * Academic structure (design §9.3): sessions and terms, sections, subject classes with their
 * teachers and students, enrolments. Writes only these tables; reads classes, class subjects and users.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicSessionEntity,
      TermEntity,
      SectionEntity,
      CourseOfferingEntity,
      OfferingTeacherEntity,
      OfferingEnrolmentEntity,
      EnrolmentEntity,
      ClassEntity,
      ClassSubjectEntity,
      SubjectEntity,
      UserEntity,
    ]),
    // OrganizationContextGuard, OrganizationAccessService, OrgSettingsService, OrganizationsService.
    OrganizationsModule,
    UserModule,
  ],
  controllers: [AcademicSessionsController, SectionsController],
  providers: [AcademicSessionsService, SectionsService, EnrolmentsService, OfferingRosterService, LegacyClassSyncSubscriber],
  exports: [AcademicSessionsService, EnrolmentsService, OfferingRosterService],
})
export class AcademicsModule {}
