import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { NOTIFICATIONS_DISPATCH_JOB, NOTIFICATIONS_QUEUE, NOTIFICATIONS_SWEEP_JOB } from '../queue/queue.constants';

/**
 * Runs the jobs on the notifications queue (worker process only, design §8.6). Each send is
 * idempotent (the dispatcher claims the row), so BullMQ retries and the sweep never send twice.
 * Several sends run at once so one slow provider call does not hold up a sign-up code.
 */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly dispatcher: NotificationDispatcherService) {
    super();
  }

  async process(job: Job<{ outboxId?: string }>): Promise<unknown> {
    switch (job.name) {
      case NOTIFICATIONS_DISPATCH_JOB:
        return job.data.outboxId ? this.dispatcher.dispatch(job.data.outboxId) : null;
      case NOTIFICATIONS_SWEEP_JOB:
        return this.dispatcher.sweep();
      default:
        this.logger.warn(`Unknown job on ${NOTIFICATIONS_QUEUE}: ${job.name}`);
        return undefined;
    }
  }
}
