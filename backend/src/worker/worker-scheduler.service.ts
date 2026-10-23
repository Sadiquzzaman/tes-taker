import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EXAMS_AUTO_SUBMIT_EVERY_MS, EXAMS_AUTO_SUBMIT_JOB, EXAMS_QUEUE } from '../queue/queue.constants';

/**
 * Registers the repeatable jobs when the worker starts. upsertJobScheduler is idempotent and
 * shared through Redis, so restarts or several workers never create duplicate schedules.
 */
@Injectable()
export class WorkerSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerSchedulerService.name);

  constructor(@InjectQueue(EXAMS_QUEUE) private readonly examsQueue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.examsQueue.upsertJobScheduler(
      EXAMS_AUTO_SUBMIT_JOB,
      { every: EXAMS_AUTO_SUBMIT_EVERY_MS },
      { name: EXAMS_AUTO_SUBMIT_JOB },
    );
    this.logger.log(`Scheduled ${EXAMS_AUTO_SUBMIT_JOB} every ${EXAMS_AUTO_SUBMIT_EVERY_MS / 1000}s`);
  }
}
