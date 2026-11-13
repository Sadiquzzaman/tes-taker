import { Module } from '@nestjs/common';
import { ProctoringGateway } from './proctoring.gateway';
import { ProctoringStoreService } from './proctoring-store.service';
import { ProctoringController } from './proctoring.controller';
import { ExamModule } from '../exams/exam.module';
import { RedisModule } from '../config/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ExamModule, RedisModule, NotificationsModule],
  controllers: [ProctoringController],
  providers: [ProctoringGateway, ProctoringStoreService],
  exports: [ProctoringStoreService],
})
export class ProctoringModule {}
