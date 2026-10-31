import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BILLING_SMS_ALLOWANCE_EVERY_MS,
  BILLING_SMS_ALLOWANCE_JOB,
  EXAMS_AUTO_SUBMIT_EVERY_MS,
  EXAMS_AUTO_SUBMIT_JOB,
  EXAMS_QUEUE,
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_SWEEP_EVERY_MS,
  NOTIFICATIONS_SWEEP_JOB,
} from '../queue/queue.constants';

/**
 * Registers the repeatable jobs when the worker starts. upsertJobScheduler is idempotent and
 * shared through Redis, so restarts or several workers never create duplicate schedules.
 */
@Injectable()
export class WorkerSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkerSchedulerService.name);

  constructor(
    @InjectQueue(EXAMS_QUEUE) private readonly examsQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.examsQueue.upsertJobScheduler(
      EXAMS_AUTO_SUBMIT_JOB,
      { every: EXAMS_AUTO_SUBMIT_EVERY_MS },
      { name: EXAMS_AUTO_SUBMIT_JOB },
    );
    this.logger.log(`Scheduled ${EXAMS_AUTO_SUBMIT_JOB} every ${EXAMS_AUTO_SUBMIT_EVERY_MS / 1000}s`);

    await this.notificationsQueue.upsertJobScheduler(
      NOTIFICATIONS_SWEEP_JOB,
      { every: NOTIFICATIONS_SWEEP_EVERY_MS },
      { name: NOTIFICATIONS_SWEEP_JOB },
    );
    this.logger.log(`Scheduled ${NOTIFICATIONS_SWEEP_JOB} every ${NOTIFICATIONS_SWEEP_EVERY_MS / 1000}s`);

    await this.notificationsQueue.upsertJobScheduler(
      BILLING_SMS_ALLOWANCE_JOB,
      { every: BILLING_SMS_ALLOWANCE_EVERY_MS },
      { name: BILLING_SMS_ALLOWANCE_JOB },
    );
    this.logger.log(`Scheduled ${BILLING_SMS_ALLOWANCE_JOB} every ${BILLING_SMS_ALLOWANCE_EVERY_MS / 60_000} min`);
  }
}
