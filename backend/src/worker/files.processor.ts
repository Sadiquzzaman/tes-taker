import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FilesService } from '../files/files.service';
import { FILES_PROCESS_JOB, FILES_QUEUE, FILES_SWEEP_JOB } from '../queue/queue.constants';

/**
 * Runs the jobs on the files queue (worker process only, design §7): files.process compresses and
 * moves one upload (FND-15); files.sweep frees abandoned uploads and re-queues stuck ones.
 * Two at a time, so image work stays light on a small server.
 */
@Processor(FILES_QUEUE, { concurrency: 2 })
export class FilesProcessor extends WorkerHost {
  private readonly logger = new Logger(FilesProcessor.name);

  constructor(private readonly files: FilesService) {
    super();
  }

  async process(job: Job<{ fileId?: string }>): Promise<unknown> {
    switch (job.name) {
      case FILES_PROCESS_JOB:
        return job.data.fileId ? this.processFile(job, job.data.fileId) : null;
      case FILES_SWEEP_JOB:
        return this.files.sweep();
      default:
        this.logger.warn(`Unknown job on ${FILES_QUEUE}: ${job.name}`);
        return undefined;
    }
  }

  private async processFile(job: Job, fileId: string): Promise<unknown> {
    try {
      return await this.files.process(fileId);
    } catch (error) {
      // After the last retry the file stops counting toward the quota.
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        await this.files.markFailed(fileId);
        this.logger.error(`File ${fileId} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
  }
}
