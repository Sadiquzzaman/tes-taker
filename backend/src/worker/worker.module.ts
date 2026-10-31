import { Module } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RedisModule } from '../config/redis.module';
import { ExamModule } from '../exams/exam.module';
import { FilesModule } from '../files/files.module';
import { QueueModule } from '../queue/queue.module';
import { ExamsProcessor } from './exams.processor';
import { FilesProcessor } from './files.processor';
import { NotificationsProcessor } from './notifications.processor';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WorkerSchedulerService } from './worker-scheduler.service';

/** The worker process: the whole app context plus the queue processors and schedules. */
@Module({
  imports: [AppModule, ExamModule, FilesModule, QueueModule, RedisModule],
  providers: [ExamsProcessor, NotificationsProcessor, FilesProcessor, WorkerSchedulerService, WorkerHeartbeatService],
})
export class WorkerModule {}
