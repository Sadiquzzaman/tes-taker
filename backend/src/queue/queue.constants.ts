/** BullMQ queue and job names (design §7). */
export const EXAMS_QUEUE = 'exams';

/** Finalises attempts past effective_deadline + 60 s, every minute. */
export const EXAMS_AUTO_SUBMIT_JOB = 'exams.auto-submit';
export const EXAMS_AUTO_SUBMIT_EVERY_MS = 60_000;

/** Sends outbox rows (design §8.6): one job per row when it is queued, plus a sweep for the rest. */
export const NOTIFICATIONS_QUEUE = 'notifications';
export const NOTIFICATIONS_DISPATCH_JOB = 'notifications.dispatch';
export const NOTIFICATIONS_SWEEP_JOB = 'notifications.sweep';
export const NOTIFICATIONS_SWEEP_EVERY_MS = 30_000;
/**
 * Grants each organisation's monthly SMS allowance and expires the last one (FND-13). Hourly, so a
 * new month starts on time in every organisation's time zone; sending also grants it when missing.
 */
export const BILLING_SMS_ALLOWANCE_JOB = 'billing.sms-allowance';
export const BILLING_SMS_ALLOWANCE_EVERY_MS = 60 * 60_000;

/** Stored files (FND-15, design §8.5): compress and move one upload; sweep stuck or abandoned ones. */
export const FILES_QUEUE = 'files';
export const FILES_PROCESS_JOB = 'files.process';
export const FILES_SWEEP_JOB = 'files.sweep';
export const FILES_SWEEP_EVERY_MS = 10 * 60_000;

/**
 * Attendance (design §7): every 5 minutes the closing job saves Absent for classes whose check-in
 * has closed (ATT-10), catching up on the last few days after the worker was down.
 */
export const ATTENDANCE_QUEUE = 'attendance';
export const ATTENDANCE_CLOSE_SESSIONS_JOB = 'attendance.close-sessions';
export const ATTENDANCE_CLOSE_SESSIONS_EVERY_MS = 5 * 60_000;
/**
 * The end of the school day (ATT-10, ATT-14): from 23:59 in each organisation's time zone (and,
 * after a worker outage, until 08:00 the next morning) it closes the day, sends the guardians'
 * absence SMS and the repeated-absence alerts. Every 5 minutes; outbox keys stop repeats.
 */
export const ATTENDANCE_END_OF_DAY_JOB = 'attendance.end-of-day';
export const ATTENDANCE_END_OF_DAY_EVERY_MS = 5 * 60_000;

/**
 * Homework (design §7): every minute it publishes scheduled homework whose time has come and sends
 * the 24-hour reminders (HW-02). Claims and outbox keys stop repeats.
 */
export const HOMEWORK_QUEUE = 'homework';
export const HOMEWORK_SWEEP_JOB = 'homework.sweep';
export const HOMEWORK_SWEEP_EVERY_MS = 60_000;

/** Redis key the worker refreshes so its container health check can see it is alive. */
export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';
export const WORKER_HEARTBEAT_EVERY_MS = 30_000;
export const WORKER_HEARTBEAT_TTL_SECONDS = 90;
