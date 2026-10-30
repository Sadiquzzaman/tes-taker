import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { TenantMiddleware } from "./common/tenancy/tenant.middleware";
import { AuditRequestMiddleware } from "./audit/audit-request-context";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AppThrottlerGuard } from "./common/guard/app-throttler.guard";
import { AUTH_IP_THROTTLER, isAuthThrottled } from "./common/decorators/auth-throttle.decorator";
import { RedisThrottlerStorage } from "./common/guard/redis-throttler.storage";
import { RedisModule } from "./config/redis.module";
import { RedisService } from "./config/redis.service";
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
import { QueueModule } from './queue/queue.module';
import { AuditModule } from './audit/audit.module';
import { AcademicsModule } from './academics/academics.module';
import { PerformanceModule } from './performance/performance.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // API tests load test/test.env themselves and must never pick up real keys from .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    CommonModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        // Shared counters in Redis, so limits hold across backend instances.
        storage: new RedisThrottlerStorage(redis),
        throttlers: [
          {
            // Generous application-wide default so normal exam traffic is never
            // throttled. Tune per deployment via THROTTLE_TTL/THROTTLE_LIMIT.
            ttl: Number(process.env.THROTTLE_TTL ?? 60000),
            limit: Number(process.env.THROTTLE_LIMIT ?? 300),
          },
          {
            // Per-IP cap for login / OTP / reset routes only (set per route by
            // @AuthThrottle). Skipped everywhere else so exam traffic from a
            // shared lab IP is never limited by IP.
            name: AUTH_IP_THROTTLER,
            ttl: 60000,
            limit: 300,
            skipIf: (context) => !isAuthThrottled(context),
            getTracker: (req) => req.ip,
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
    QueueModule,
    AuditModule,
    AcademicsModule,
    PerformanceModule,
    NotificationsModule,
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
export class AppModule implements NestModule {
  /**
   * Every request gets its own tenant store (design §8.1; OrganizationContextGuard fills it in)
   * and remembers the caller's IP for the audit log (design §8.10).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware, AuditRequestMiddleware).forRoutes("*");
  }
}
