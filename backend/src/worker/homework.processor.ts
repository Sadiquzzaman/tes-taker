import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { HomeworkService } from '../homework/homework.service';
import { HOMEWORK_QUEUE, HOMEWORK_SWEEP_JOB } from '../queue/queue.constants';

/**
 * Runs the jobs on the homework queue (worker process only, design §7): homework.sweep publishes
 * scheduled homework and sends the 24-hour reminders (HW-02). Safe to run twice; one at a time.
 */
@Processor(HOMEWORK_QUEUE, { concurrency: 1 })
export class HomeworkProcessor extends WorkerHost {
  private readonly logger = new Logger(HomeworkProcessor.name);

  constructor(private readonly homework: HomeworkService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case HOMEWORK_SWEEP_JOB:
        return this.homework.sweep();
      default:
        this.logger.warn(`Unknown job on ${HOMEWORK_QUEUE}: ${job.name}`);
        return undefined;
    }
  }
}
