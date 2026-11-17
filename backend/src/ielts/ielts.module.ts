import { IeltsCourseEntity } from './entities/ielts-course.entity';
import { IeltsCoursesService } from './ielts-courses.service';
import { IeltsCoursesController } from './ielts-courses.controller';
import { AcademicsModule } from 'src/academics/academics.module';
import { ClassModule } from 'src/classes/class.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { IeltsAnswerEntity } from './entities/ielts-answer.entity';
import { IeltsAssignmentEntity } from './entities/ielts-assignment.entity';
import { IeltsAttemptEntity } from './entities/ielts-attempt.entity';
import { IeltsBandTableEntity } from './entities/ielts-band-table.entity';
import { IeltsProfileEntity } from './entities/ielts-profile.entity';
import { IeltsQuestionGroupEntity } from './entities/ielts-question-group.entity';
import { IeltsQuestionEntity } from './entities/ielts-question.entity';
import { IeltsTestPartEntity } from './entities/ielts-test-part.entity';
import { IeltsTestEntity } from './entities/ielts-test.entity';
import { IeltsAssignmentsService } from './ielts-assignments.service';
import { IeltsAttemptsService } from './ielts-attempts.service';
import { IeltsBandTablesService } from './ielts-band-tables.service';
import { IeltsController } from './ielts.controller';
import { IeltsConvertService } from './ielts-convert.service';
import { IeltsGroupsService } from './ielts-groups.service';
import { IeltsMarkingService } from './ielts-marking.service';
import { IeltsProfilesService } from './ielts-profiles.service';
import { IeltsProgressService } from './ielts-progress.service';
import { IeltsTestsService } from './ielts-tests.service';

/**
 * The IELTS workspace (Epic 11, re-designed 15 Nov 2026; design §9.10): owns ielts_profiles
 * (P10-01), ielts_band_tables and the IELTS tests with their parts, question groups and questions
 * (P10-02); assignments, attempts and answers (P10-04).
 */
@Module({
  imports: [TypeOrmModule.forFeature([IeltsProfileEntity, IeltsBandTableEntity, IeltsTestEntity, IeltsTestPartEntity, IeltsQuestionGroupEntity, IeltsQuestionEntity, IeltsAssignmentEntity, IeltsAttemptEntity, IeltsAnswerEntity, IeltsCourseEntity]), OrganizationsModule, SubscriptionModule, AcademicsModule, ClassModule],
  controllers: [IeltsController, IeltsCoursesController],
  providers: [IeltsCoursesService, IeltsProfilesService, IeltsBandTablesService, IeltsTestsService, IeltsGroupsService, IeltsAttemptsService, IeltsAssignmentsService, IeltsMarkingService, IeltsProgressService, IeltsConvertService],
  exports: [IeltsProfilesService, IeltsBandTablesService, IeltsTestsService],
})
export class IeltsModule {}
