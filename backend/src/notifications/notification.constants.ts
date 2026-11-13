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
  ATTENDANCE_CLASS_CANCELLED: 'attendance.class_cancelled',
  ATTENDANCE_CLASS_RESTORED: 'attendance.class_restored',
  /** A class's time or teacher changed for one day (P5-04); students and the teachers involved. */
  ATTENDANCE_CLASS_CHANGED: 'attendance.class_changed',
  ATTENDANCE_LATE: 'attendance.late',
  ATTENDANCE_ABSENT: 'attendance.absent',
  ATTENDANCE_REPEAT_ABSENCE: 'attendance.repeat_absence',
  ATTENDANCE_LEAVE_APPLIED: 'attendance.leave_applied',
  ATTENDANCE_LEAVE_REQUESTED: 'attendance.leave_requested',
  ATTENDANCE_LEAVE_APPROVED: 'attendance.leave_approved',
  ATTENDANCE_LEAVE_REJECTED: 'attendance.leave_rejected',
  ATTENDANCE_LEAVE_CANCELLED: 'attendance.leave_cancelled',
  HOMEWORK_ASSIGNED: 'homework.assigned',
  HOMEWORK_DUE_SOON: 'homework.due_soon',
  HOMEWORK_RETURNED: 'homework.returned',
  HOMEWORK_SCORES_PUBLISHED: 'homework.scores_published',
  HOMEWORK_REMINDER: 'homework.reminder',
  HOMEWORK_MISSING: 'homework.missing',
  /** Calendar events (P5-05, CAL-03, CAL-06): added, changed or cancelled; in-app to the attendees. */
  CALENDAR_EVENT_ADDED: 'calendar.event_added',
  CALENDAR_EVENT_CHANGED: 'calendar.event_changed',
  CALENDAR_EVENT_CANCELLED: 'calendar.event_cancelled',
  /** A reminder before a class, exam or event (P5-05, CAL-05): in-app, or SMS to the person on org credits. */
  CALENDAR_REMINDER: 'calendar.reminder',
  /** A report card shared with a student's guardians (P7-04, PRF-09): SMS with a summary and the 30-day link. */
  REPORT_CARD_SHARED: 'report_card.shared',
  /** A student reached the exam's alert level of flags (P8-03, PRO-08): in-app to the teacher, at most every 5 minutes. */
  PROCTORING_ALERT: 'proctoring.alert',
  /** A teacher reviewed a student's exam attempt (P8-04, PRO-05): in-app to the student, with the decision. */
  EXAM_REVIEW_DECIDED: 'exam.review_decided',
  /** A teacher posted in a group chat that is in announcement mode (P9-01, COM-01, COM-03): in-app to the members who have not muted it. */
  CHAT_ANNOUNCEMENT: 'chat.announcement',
  /** A private chat message (P9-02, COM-02, COM-03): in-app to the other person, at most one notice per chat every 10 minutes. */
  CHAT_DIRECT_MESSAGE: 'chat.direct_message',
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

/**
 * Messages a user can choose channels for (FND-12), with the channels on by default. In-app (the
 * bell) is always on and free; SMS uses the organisation's credits.
 */
export const NOTIFICATION_PREFERENCES: Record<string, { allowed: NotificationChannelEnum[]; defaults: NotificationChannelEnum[] }> = {
  [NOTIFICATION_EVENTS.EXAM_SCHEDULED]: {
    allowed: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.SMS, NotificationChannelEnum.EMAIL],
    defaults: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.SMS],
  },
  [NOTIFICATION_EVENTS.SMS_LOW_CREDIT]: {
    allowed: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
    defaults: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
  },
  [NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED]: {
    allowed: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
    defaults: [NotificationChannelEnum.IN_APP, NotificationChannelEnum.EMAIL],
  },
};
