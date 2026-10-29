import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'src/config/redis.module';
import { ExamEntity } from 'src/exams/entities/exam.entity';
import { OrganizationsModule } from 'src/organizations/organization.module';
import { UserEntity } from 'src/user/entities/user.entity';
import { AccountSubscriptionEntity } from './entities/account-subscription.entity';
import { FeatureOverrideEntity } from './entities/feature-override.entity';
import { FeatureRequestEntity } from './entities/feature-request.entity';
import { PaymentHistoryEntity } from './entities/payment-history.entity';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { EntitlementsService } from './entitlements.service';
import { FeatureGuard } from './guards/feature.guard';
import { MeController } from './me.controller';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlanEntity,
      AccountSubscriptionEntity,
      FeatureOverrideEntity,
      FeatureRequestEntity,
      PaymentHistoryEntity,
      UserEntity,
      ExamEntity,
    ]),
    RedisModule,
    // SoloOrganizationService, OrganizationContextGuard and the organisation repositories.
    OrganizationsModule,
  ],
  controllers: [SubscriptionController, MeController],
  providers: [SubscriptionService, EntitlementsService, FeatureGuard],
  exports: [SubscriptionService, EntitlementsService, FeatureGuard],
})
export class SubscriptionModule {}
