import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { UserModule } from "./user/user.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExamModule } from './exams/exam.module';
import { ClassModule } from './classes/class.module';
import { SubscriptionModule } from './subscriptions/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: String(configService.get("DATABASE_HOST")),
        port: Number(configService.get("DATABASE_PORT")),
        username: String(configService.get("DATABASE_USER")),
        password: String(configService.get("DATABASE_PASSWORD") ?? ""),
        database: String(configService.get("DATABASE_DB")),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: true,
        logging: false,
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    UserModule,
    ExamModule,
    ClassModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
