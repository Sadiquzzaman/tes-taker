import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OrganizationMemberEntity } from 'src/organizations/entities/organization-member.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { PerformanceModule } from 'src/performance/performance.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { HomeworkAttachmentEntity } from './entities/homework-attachment.entity';
import { HomeworkScoreEntity } from './entities/homework-score.entity';
import { HomeworkSubmissionEntity } from './entities/homework-submission.entity';
import { SubmissionFileEntity } from './entities/submission-file.entity';
import { HomeworkTargetEntity } from './entities/homework-target.entity';
import { HomeworkEntity } from './entities/homework.entity';
import { HomeworkClock } from './homework-clock';
import { HomeworkController } from './homework.controller';
import { HomeworkScoresService } from './homework-scores.service';
import { HomeworkSettingsService } from './homework-settings.service';
import { HomeworkSubmissionsService } from './homework-submissions.service';
import { HomeworkService } from './homework.service';

/**
 * Homework (Epic 2, design §4): owns homework, homework_targets and homework_attachments. So far:
 * writing, publishing (now or scheduled) and withdrawing homework for subject classes, the
 * students' list, and the in-app notices when it is given and 24 hours before it is due (HW-01, HW-02).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([HomeworkEntity, HomeworkTargetEntity, HomeworkAttachmentEntity, HomeworkSubmissionEntity, SubmissionFileEntity, HomeworkScoreEntity, OrganizationMemberEntity]),
    OrganizationsModule,
    AcademicsModule,
    NotificationsModule,
    SubscriptionModule,
    PerformanceModule,
  ],
  controllers: [HomeworkController],
  providers: [HomeworkService, HomeworkSubmissionsService, HomeworkScoresService, HomeworkSettingsService, HomeworkClock],
  exports: [HomeworkService, HomeworkScoresService],
})
export class HomeworkModule {}
