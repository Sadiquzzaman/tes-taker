import { Module } from '@nestjs/common';
import { AppModule } from '../app.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { CalendarFeedModule } from '../calendar-feed/calendar-feed.module';
import { RedisModule } from '../config/redis.module';
import { ExamModule } from '../exams/exam.module';
import { FilesModule } from '../files/files.module';
import { QueueModule } from '../queue/queue.module';
import { HomeworkModule } from '../homework/homework.module';
import { AttendanceProcessor } from './attendance.processor';
import { CalendarProcessor } from './calendar.processor';
import { HomeworkProcessor } from './homework.processor';
import { ExamsProcessor } from './exams.processor';
import { FilesProcessor } from './files.processor';
import { NotificationsProcessor } from './notifications.processor';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WorkerSchedulerService } from './worker-scheduler.service';

/** The worker process: the whole app context plus the queue processors and schedules. */
@Module({
  imports: [AppModule, AttendanceModule, CalendarFeedModule, HomeworkModule, ExamModule, FilesModule, QueueModule, RedisModule],
  providers: [ExamsProcessor, NotificationsProcessor, FilesProcessor, AttendanceProcessor, HomeworkProcessor, CalendarProcessor, WorkerSchedulerService, WorkerHeartbeatService],
})
export class WorkerModule {}
