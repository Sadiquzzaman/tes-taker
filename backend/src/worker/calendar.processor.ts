import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RemindersService } from '../calendar-feed/reminders.service';
import { CALENDAR_QUEUE, CALENDAR_REMINDERS_JOB } from '../queue/queue.constants';

/**
 * Runs the jobs on the calendar queue (worker process only, design §7): calendar.reminders sends
 * the reminders due before classes, exams and events (CAL-05). Safe to run twice; one at a time.
 */
@Processor(CALENDAR_QUEUE, { concurrency: 1 })
export class CalendarProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarProcessor.name);

  constructor(private readonly reminders: RemindersService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case CALENDAR_REMINDERS_JOB:
        return this.reminders.sweep();
      default:
        this.logger.warn(`Unknown job on ${CALENDAR_QUEUE}: ${job.name}`);
        return undefined;
    }
  }
}
