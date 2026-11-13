import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicsModule } from 'src/academics/academics.module';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { SubscriptionModule } from 'src/subscriptions/subscription.module';
import { BehaviourController } from './behaviour.controller';
import { BehaviourService } from './behaviour.service';
import { BehaviourCriterionEntity } from './entities/behaviour-criterion.entity';
import { BehaviourRatingEntity } from './entities/behaviour-rating.entity';

/**
 * Epic 3 results (design §8.11, §9.8): behaviour criteria and ratings now; weights, scores, the
 * dashboards and report cards next. It reads exams, homework and attendance through their services
 * and owns only its own tables (the grading scale stays in `performance`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([BehaviourCriterionEntity, BehaviourRatingEntity]), AcademicsModule, OrganizationsModule, SubscriptionModule],
  controllers: [BehaviourController],
  providers: [BehaviourService],
  exports: [BehaviourService],
})
export class ResultsModule {}
