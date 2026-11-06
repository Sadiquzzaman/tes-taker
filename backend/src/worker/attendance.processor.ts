import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AttendanceAlertsService } from '../attendance/attendance-alerts.service';
import { SessionClosingService } from '../attendance/session-closing.service';
import { ATTENDANCE_CLOSE_SESSIONS_JOB, ATTENDANCE_END_OF_DAY_JOB, ATTENDANCE_QUEUE } from '../queue/queue.constants';

/**
 * Runs the jobs on the attendance queue (worker process only, design §7): attendance.close-sessions
 * saves Absent for classes whose check-in has closed (ATT-10); attendance.end-of-day sends the
 * guardians' absence SMS and the repeated-absence alerts (ATT-10, ATT-14). Safe to run twice; one at a time.
 */
@Processor(ATTENDANCE_QUEUE, { concurrency: 1 })
export class AttendanceProcessor extends WorkerHost {
  private readonly logger = new Logger(AttendanceProcessor.name);

  constructor(
    private readonly closing: SessionClosingService,
    private readonly alerts: AttendanceAlertsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case ATTENDANCE_CLOSE_SESSIONS_JOB:
        return this.closing.closeEnded();
      case ATTENDANCE_END_OF_DAY_JOB:
        return this.alerts.endOfDay();
      default:
        this.logger.warn(`Unknown job on ${ATTENDANCE_QUEUE}: ${job.name}`);
        return undefined;
    }
  }
}
