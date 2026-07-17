import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { buildTypeOrmOptions } from "./config/typeorm.config";
import { ExamModule } from './exams/exam.module';
import { ClassModule } from './classes/class.module';
import { SubscriptionModule } from './subscriptions/subscription.module';
import { SubjectModule } from './subjects/subject.module';
import { ProctoringModule } from './proctoring/proctoring.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        ...buildTypeOrmOptions(),
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    UserModule,
    ExamModule,
    ClassModule,
    SubscriptionModule,
    SubjectModule,
    ProctoringModule,
    PaymentModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
