import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlanEntity } from './entities/subscription-plan.entity';
import { TeacherSubscriptionEntity } from './entities/teacher-subscription.entity';
import { PaymentHistoryEntity } from './entities/payment-history.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { UserEntity } from 'src/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlanEntity,
      TeacherSubscriptionEntity,
      PaymentHistoryEntity,
      UserEntity,
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
