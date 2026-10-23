import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { StudentExamService } from '../exams/student-exam.service';
import { EXAMS_AUTO_SUBMIT_JOB, EXAMS_QUEUE } from '../queue/queue.constants';

/** Runs the jobs on the exams queue (worker process only). */
@Processor(EXAMS_QUEUE)
export class ExamsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExamsProcessor.name);

  constructor(private readonly studentExamService: StudentExamService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case EXAMS_AUTO_SUBMIT_JOB:
        return this.studentExamService.autoSubmitExpired();
      default:
        this.logger.warn(`Unknown job on ${EXAMS_QUEUE}: ${job.name}`);
        return undefined;
    }
  }
}
