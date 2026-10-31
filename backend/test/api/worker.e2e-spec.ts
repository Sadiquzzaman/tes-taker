import { getQueueToken } from '@nestjs/bullmq';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from '../../src/exams/entities/student-exam-answer.entity';
import {
  EXAMS_AUTO_SUBMIT_EVERY_MS,
  EXAMS_AUTO_SUBMIT_JOB,
  EXAMS_QUEUE,
  FILES_QUEUE,
  FILES_SWEEP_EVERY_MS,
  FILES_SWEEP_JOB,
  NOTIFICATIONS_QUEUE,
  NOTIFICATIONS_SWEEP_EVERY_MS,
  NOTIFICATIONS_SWEEP_JOB,
  WORKER_HEARTBEAT_KEY,
} from '../../src/queue/queue.constants';
import { FileObjectEntity } from '../../src/files/entities/file-object.entity';
import { FileStatusEnum } from '../../src/files/file-rules';
import { NotificationOutboxEntity } from '../../src/notifications/entities/notification-outbox.entity';
import { NOTIFICATION_EVENTS, NotificationChannelEnum, OutboxStatusEnum } from '../../src/notifications/notification.constants';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { SmsService } from '../../src/sms/sms.service';
import { UserEntity } from '../../src/user/entities/user.entity';
import { WorkerModule } from '../../src/worker/worker.module';
import { factories } from '../support/factories';
import { createTestApp, TestApp } from '../support/test-app';

/**
 * The worker process (P0-04) with the real BullMQ queue on the test Redis: the
 * exams.auto-submit job finalises abandoned attempts and nothing else.
 */
describe('worker: exams.auto-submit', () => {
  let t: TestApp;
  let worker: INestApplicationContext;
  let queue: Queue;
  let queueEvents: QueueEvents;
  let make: ReturnType<typeof factories>;

  const redisConnection = () => ({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) });

  beforeAll(async () => {
    t = await createTestApp();
    make = factories(t.dataSource);
    process.env.APP_ROLE = 'worker';
    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: ['error'] });
    worker.enableShutdownHooks();
    queue = worker.get<Queue>(getQueueToken(EXAMS_QUEUE));
    queueEvents = new QueueEvents(EXAMS_QUEUE, { connection: redisConnection() });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await queueEvents.close();
    await worker.close();
    delete process.env.APP_ROLE;
    await t.close();
  });

  const submissions = () => t.dataSource.getRepository(StudentExamSubmissionEntity);

  const startAttempt = async (examId: string, student: UserEntity) => {
    const response = await t.api.post(`/student/exams/${examId}/start`, { user_agent: 'api-test' }, t.tokenFor(student));
    expect(response.status).toBe(201);
  };

  /** Adds one auto-submit run now and waits for the worker to finish it. */
  const runAutoSubmit = async () => {
    const job = await queue.add(EXAMS_AUTO_SUBMIT_JOB, {});
    return (await job.waitUntilFinished(queueEvents, 30_000)) as { checked: number; submitted: number };
  };

  it('schedules auto-submit every minute and keeps a heartbeat', async () => {
    const scheduler = await queue.getJobScheduler(EXAMS_AUTO_SUBMIT_JOB);
    expect(scheduler?.every).toBe(EXAMS_AUTO_SUBMIT_EVERY_MS);

    const redis = new Redis(redisConnection());
    await expect(redis.exists(WORKER_HEARTBEAT_KEY)).resolves.toBe(1);
    redis.disconnect();
  });

  it('auto-submits abandoned attempts, leaves running ones alone, and is safe to run again', async () => {
    const teacher = await make.teacher();
    const exam = await make.openExam(teacher, { duration_minutes: 30 });
    const [abandoned, legacy, running] = await Promise.all([make.student(), make.student(), make.student()]);
    for (const student of [abandoned, legacy, running]) {
      await startAttempt(exam.id, student);
    }
    // Abandoned: deadline passed more than 60 s ago.
    await submissions().update(
      { exam_id: exam.id, student_id: abandoned.id },
      { effective_deadline: new Date(Date.now() - 2 * 60_000) },
    );
    // Started before effective_deadline existed: no stored deadline, started 40 min ago (30-min exam).
    await submissions().update(
      { exam_id: exam.id, student_id: legacy.id },
      { effective_deadline: null, started_at: new Date(Date.now() - 40 * 60_000) },
    );

    await runAutoSubmit();

    const statusOf = async (student: UserEntity) =>
      submissions().findOneByOrFail({ exam_id: exam.id, student_id: student.id });
    const [abandonedRow, legacyRow, runningRow] = await Promise.all([statusOf(abandoned), statusOf(legacy), statusOf(running)]);
    expect(abandonedRow.status).toBe(ExamSubmissionStatusEnum.AUTO_SUBMITTED);
    expect(abandonedRow.submitted_at).toBeTruthy();
    expect(legacyRow.status).toBe(ExamSubmissionStatusEnum.AUTO_SUBMITTED);
    expect(runningRow.status).toBe(ExamSubmissionStatusEnum.IN_PROGRESS);

    // A second run finds nothing new to finalise and changes nothing.
    const again = await runAutoSubmit();
    expect(again.submitted).toBe(0);
    expect((await statusOf(abandoned)).submitted_at).toEqual(abandonedRow.submitted_at);
    expect((await statusOf(running)).status).toBe(ExamSubmissionStatusEnum.IN_PROGRESS);
  });

  it('lets the student see their auto-submitted attempt as already submitted', async () => {
    const teacher = await make.teacher();
    const exam = await make.openExam(teacher);
    const student = await make.student();
    await startAttempt(exam.id, student);
    await submissions().update(
      { exam_id: exam.id, student_id: student.id },
      { effective_deadline: new Date(Date.now() - 2 * 60_000) },
    );

    await runAutoSubmit();

    const eligibility = await t.api.get<{ payload: { reason_code: string } }>(
      `/student/exams/${exam.id}/eligibility`,
      t.tokenFor(student),
    );
    expect(eligibility.body.payload.reason_code).toBe('ALREADY_SUBMITTED');
  });

  it('sends a queued SMS from the notifications job, and sweeps every 30 s (P2-08)', async () => {
    const notificationsQueue = worker.get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE));
    expect((await notificationsQueue.getJobScheduler(NOTIFICATIONS_SWEEP_JOB))?.every).toBe(NOTIFICATIONS_SWEEP_EVERY_MS);

    // The fake provider in the worker: nothing leaves the test.
    const deliver = jest.spyOn(worker.get(SmsService), 'deliver').mockResolvedValue({ messageId: 'worker-1' });
    const student = await make.student();
    const [id] = await t.app.get(NotificationsService).enqueue({
      eventType: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
      channel: NotificationChannelEnum.SMS,
      organizationId: null,
      userId: student.id,
      variables: { exam_title: 'Algebra', exam_start_at: new Date().toISOString() },
    });

    const outbox = t.dataSource.getRepository(NotificationOutboxEntity);
    let status: OutboxStatusEnum | undefined;
    for (let i = 0; i < 100 && status !== OutboxStatusEnum.SENT; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      status = (await outbox.findOneByOrFail({ id })).status;
    }
    expect(status).toBe(OutboxStatusEnum.SENT);
    expect(deliver).toHaveBeenCalledWith(student.phone, expect.stringContaining('Algebra'));
  });

  it('compresses an upload in the files.process job, and sweeps files every 10 min (P2-07)', async () => {
    const filesQueue = worker.get<Queue>(getQueueToken(FILES_QUEUE));
    expect((await filesQueue.getJobScheduler(FILES_SWEEP_JOB))?.every).toBe(FILES_SWEEP_EVERY_MS);

    const teacher = await make.teacher();
    const form = new FormData();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
      'base64',
    );
    form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'dot.png');
    const origin = (await t.app.getUrl()).replace('[::1]', '127.0.0.1');
    const response = await fetch(`${origin}/api/v1/uploads/media?purpose=exam`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.tokenFor(teacher)}` },
      body: form,
    });
    expect(response.status).toBe(201);
    const { payload } = (await response.json()) as { payload: { id: string } };

    const files = t.dataSource.getRepository(FileObjectEntity);
    let file = await files.findOneByOrFail({ id: payload.id });
    for (let i = 0; i < 100 && file.status === FileStatusEnum.PENDING; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      file = await files.findOneByOrFail({ id: payload.id });
    }
    expect(file).toMatchObject({ status: FileStatusEnum.READY, mime: 'image/webp', width: 2, height: 2 });
  });
});
