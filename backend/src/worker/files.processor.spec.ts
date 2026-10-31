import { Job } from 'bullmq';
import { FilesService } from '../files/files.service';
import { FILES_PROCESS_JOB, FILES_SWEEP_JOB } from '../queue/queue.constants';
import { FilesProcessor } from './files.processor';

describe('FilesProcessor', () => {
  const files = { process: jest.fn(), markFailed: jest.fn(), sweep: jest.fn() };
  const processor = new FilesProcessor(files as unknown as FilesService);
  const job = (attemptsMade: number) =>
    ({ name: FILES_PROCESS_JOB, data: { fileId: 'f1' }, attemptsMade, opts: { attempts: 3 } }) as unknown as Job<{ fileId?: string }>;

  beforeEach(() => jest.clearAllMocks());

  it('processes the file', async () => {
    files.process.mockResolvedValue({ fileId: 'f1', status: 'READY' });
    await expect(processor.process(job(0))).resolves.toEqual({ fileId: 'f1', status: 'READY' });
  });

  it('lets BullMQ retry without marking the file failed', async () => {
    files.process.mockRejectedValue(new Error('storage down'));
    await expect(processor.process(job(1))).rejects.toThrow('storage down');
    expect(files.markFailed).not.toHaveBeenCalled();
  });

  it('marks the file FAILED after the last attempt, so it stops counting toward the quota', async () => {
    files.process.mockRejectedValue(new Error('storage down'));
    await expect(processor.process(job(2))).rejects.toThrow('storage down');
    expect(files.markFailed).toHaveBeenCalledWith('f1');
  });

  it('runs the sweep', async () => {
    files.sweep.mockResolvedValue({ abandoned: 1, requeued: 0 });
    await expect(processor.process({ name: FILES_SWEEP_JOB, data: {} } as Job)).resolves.toEqual({ abandoned: 1, requeued: 0 });
  });
});
