import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { ExamModule } from 'src/exams/exam.module';
import { HomeworkModule } from 'src/homework/homework.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { PerformanceModule } from 'src/performance/performance.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { BehaviourController } from './behaviour.controller';
import { BehaviourService } from './behaviour.service';
import { BehaviourCriterionEntity } from './entities/behaviour-criterion.entity';
import { BehaviourRatingEntity } from './entities/behaviour-rating.entity';
import { ReportCardEntity } from './entities/report-card.entity';
import { ScoreWeightEntity } from './entities/score-weight.entity';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';
import { ScoreSettingsService } from './score-settings.service';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';

/**
 * Epic 3 results (design §8.11, §9.8): behaviour criteria and ratings, score weights and the live
 * scores; the dashboards and report cards next. It reads exams, homework and attendance through
 * their services and owns only its own tables (the grading scale stays in `performance`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BehaviourCriterionEntity, BehaviourRatingEntity, ScoreWeightEntity, ReportCardEntity]),
    AcademicsModule,
    AttendanceModule,
    ExamModule,
    HomeworkModule,
    OrganizationsModule,
    PerformanceModule,
    SubscriptionModule,
  ],
  controllers: [BehaviourController, ScoresController, ReportCardsController],
  providers: [BehaviourService, ScoresService, ScoreSettingsService, ReportCardsService],
  exports: [BehaviourService, ScoresService],
})
export class ResultsModule {}
