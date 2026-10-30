/** How a message reaches someone (design §8.6). Push (FCM) is deferred until the mobile app. */
export enum NotificationChannelEnum {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

/**
 * Where an outbox row is (FND-14). SENDING is set while the worker hands the message to the
 * provider, so a crash can never send it twice; DELIVERED waits for delivery reports (TODO).
 */
export enum OutboxStatusEnum {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  NO_CREDIT = 'NO_CREDIT',
}

export enum RecipientTypeEnum {
  USER = 'USER',
  GUARDIAN = 'GUARDIAN',
  /** An address with no account behind it (an invited email, a phone signing up). */
  ADDRESS = 'ADDRESS',
}

export const NOTIFICATION_LOCALES = ['bn', 'en'] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

/**
 * Every message the platform sends, named `<area>.<event>`. A new event needs a default template
 * (default-templates.ts) for each channel it uses, in bn and en.
 */
export const NOTIFICATION_EVENTS = {
  AUTH_OTP: 'auth.otp',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  CLASS_INVITATION: 'class.invitation',
  ORGANIZATION_INVITATION: 'organization.invitation',
  EXAM_SCHEDULED: 'exam.scheduled',
  FEATURE_REQUEST_CREATED: 'feature_request.created',
  SMS_LOW_CREDIT: 'sms.low_credit',
} as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/** Events whose variables are secrets (codes): they are removed from the row once it is sent. */
export const SENSITIVE_EVENTS: ReadonlySet<string> = new Set([
  NOTIFICATION_EVENTS.AUTH_OTP,
  NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET,
]);

/** Provider attempts before a row is FAILED, and the wait before each retry (design §7). */
export const DISPATCH_MAX_ATTEMPTS = 3;
export const DISPATCH_RETRY_DELAYS_MS = [30_000, 120_000];
/** A row left SENDING this long (worker crashed mid-send) is marked FAILED, never re-sent. */
export const DISPATCH_STALE_SENDING_MS = 10 * 60_000;
/** Rows one sweep picks up. */
export const DISPATCH_SWEEP_BATCH = 200;
