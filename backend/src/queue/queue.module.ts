import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXAMS_QUEUE, FILES_QUEUE, NOTIFICATIONS_QUEUE } from './queue.constants';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

/**
 * BullMQ on the existing Redis. The API registers the queues (to add jobs and to show them
 * in bull-board); only the worker process (worker.ts) runs their processors.
 * Job defaults follow design §7: 3 attempts with exponential back-off, failed jobs kept 7 days.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get<number>('REDIS_PORT', 6379)),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: Number(config.get<number>('REDIS_DB', 0)),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
          removeOnFail: { age: SEVEN_DAYS_SECONDS },
        },
      }),
    }),
    BullModule.registerQueue({ name: EXAMS_QUEUE }, { name: NOTIFICATIONS_QUEUE }, { name: FILES_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
