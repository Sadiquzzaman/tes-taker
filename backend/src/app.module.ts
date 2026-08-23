import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppThrottlerGuard } from "./common/guard/app-throttler.guard";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { getMongoUri } from "./config/mongodb.config";
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
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { TeacherRequestModule } from './teacher-requests/teacher-request.module';
import { OrganizationsModule } from './organizations/organization.module';
import { ChatMongoModule } from './chat-mongo/chat-mongo.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            // Generous application-wide default so normal exam traffic is never
            // throttled. Tune per deployment via THROTTLE_TTL/THROTTLE_LIMIT.
            ttl: Number(process.env.THROTTLE_TTL ?? 60000),
            limit: Number(process.env.THROTTLE_LIMIT ?? 300),
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        ...buildTypeOrmOptions(),
        autoLoadEntities: true,
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: getMongoUri(config),
        serverSelectionTimeoutMS: 5000,
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
    HealthModule,
    StorageModule,
    TeacherRequestModule,
    OrganizationsModule,
    ChatMongoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
