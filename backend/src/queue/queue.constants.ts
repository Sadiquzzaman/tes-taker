/** BullMQ queue and job names (design §7). */
export const EXAMS_QUEUE = 'exams';

/** Finalises attempts past effective_deadline + 60 s, every minute. */
export const EXAMS_AUTO_SUBMIT_JOB = 'exams.auto-submit';
export const EXAMS_AUTO_SUBMIT_EVERY_MS = 60_000;

/** Redis key the worker refreshes so its container health check can see it is alive. */
export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';
export const WORKER_HEARTBEAT_EVERY_MS = 30_000;
export const WORKER_HEARTBEAT_TTL_SECONDS = 90;
