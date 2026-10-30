import { NOTIFICATION_EVENTS, NotificationChannelEnum, NotificationLocale } from './notification.constants';

export interface DefaultTemplate {
  event_type: string;
  channel: NotificationChannelEnum;
  locale: NotificationLocale;
  subject: string | null;
  body: string;
}

const { SMS, EMAIL } = NotificationChannelEnum;

/**
 * The platform's default text for every event (design §8.6), in Bangla and English. Added to
 * `message_templates` at start-up when missing (MessageTemplatesService), and used directly if a row
 * is missing. `{{name}}` is replaced by the variable; variables ending in `_at` are dates, shown in
 * the recipient's language and the organisation's time zone. Email bodies are HTML (variables are
 * escaped) and are wrapped in the standard layout.
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // Sign-up code (platform-paid, never charged to an organisation)
  { event_type: NOTIFICATION_EVENTS.AUTH_OTP, channel: SMS, locale: 'en', subject: null, body: 'Your Instructor code is {{otp}}. Valid for 5 minutes.' },
  { event_type: NOTIFICATION_EVENTS.AUTH_OTP, channel: SMS, locale: 'bn', subject: null, body: 'আপনার Instructor কোড {{otp}}। ৫ মিনিট পর্যন্ত বৈধ।' },

  // Password reset code
  { event_type: NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET, channel: SMS, locale: 'en', subject: null, body: 'Your Instructor password reset code is {{otp}}. Valid for 5 minutes.' },
  { event_type: NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET, channel: SMS, locale: 'bn', subject: null, body: 'আপনার Instructor পাসওয়ার্ড রিসেট কোড {{otp}}। ৫ মিনিট পর্যন্ত বৈধ।' },
  {
    event_type: NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET,
    channel: EMAIL,
    locale: 'en',
    subject: 'Reset your Instructor password',
    body:
      '<h2>Reset your Instructor password</h2><p>Hello {{name}},</p><p>Use this code to reset your password. It is valid for 5 minutes.</p>' +
      '<p class="code">{{otp}}</p><p class="muted">If you didn\'t ask for this, you can ignore this email.</p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.AUTH_PASSWORD_RESET,
    channel: EMAIL,
    locale: 'bn',
    subject: 'আপনার Instructor পাসওয়ার্ড রিসেট করুন',
    body:
      '<h2>আপনার Instructor পাসওয়ার্ড রিসেট করুন</h2><p>প্রিয় {{name}},</p><p>পাসওয়ার্ড রিসেট করতে এই কোডটি ব্যবহার করুন। এটি ৫ মিনিট পর্যন্ত বৈধ।</p>' +
      '<p class="code">{{otp}}</p><p class="muted">আপনি এটি না চাইলে এই ইমেইলটি উপেক্ষা করুন।</p>',
  },

  // Class invitation
  {
    event_type: NOTIFICATION_EVENTS.CLASS_INVITATION,
    channel: EMAIL,
    locale: 'en',
    subject: 'Invitation to join {{class_name}} on Instructor',
    body:
      '<h2>You\'ve been invited to join a class</h2><p>{{inviter_name}} invited you to join <strong>{{class_name}}</strong> on Instructor.</p>' +
      '<p><a class="button" href="{{link}}">Join class</a></p><p class="muted">{{link}}</p><p class="muted">This invitation expires in 7 days.</p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.CLASS_INVITATION,
    channel: EMAIL,
    locale: 'bn',
    subject: 'Instructor-এ {{class_name}} ক্লাসে যোগ দেওয়ার আমন্ত্রণ',
    body:
      '<h2>আপনাকে একটি ক্লাসে আমন্ত্রণ জানানো হয়েছে</h2><p>{{inviter_name}} আপনাকে Instructor-এ <strong>{{class_name}}</strong> ক্লাসে যোগ দিতে আমন্ত্রণ জানিয়েছেন।</p>' +
      '<p><a class="button" href="{{link}}">ক্লাসে যোগ দিন</a></p><p class="muted">{{link}}</p><p class="muted">এই আমন্ত্রণ ৭ দিন পর্যন্ত বৈধ।</p>',
  },

  // Organisation invitation
  {
    event_type: NOTIFICATION_EVENTS.ORGANIZATION_INVITATION,
    channel: EMAIL,
    locale: 'en',
    subject: 'Invitation to join {{organization_name}} on Instructor',
    body:
      '<h2>You\'ve been invited to join an organisation</h2><p>{{inviter_name}} invited you to join <strong>{{organization_name}}</strong> as <strong>{{role}}</strong> on Instructor.</p>' +
      '<p>Sign up or sign in with this email (or your phone) to accept.</p><p><a class="button" href="{{link}}">Join organisation</a></p>' +
      '<p class="muted">{{link}}</p><p class="muted">This invitation expires in 7 days.</p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.ORGANIZATION_INVITATION,
    channel: EMAIL,
    locale: 'bn',
    subject: 'Instructor-এ {{organization_name}}-এ যোগ দেওয়ার আমন্ত্রণ',
    body:
      '<h2>আপনাকে একটি প্রতিষ্ঠানে আমন্ত্রণ জানানো হয়েছে</h2><p>{{inviter_name}} আপনাকে Instructor-এ <strong>{{organization_name}}</strong>-এ <strong>{{role}}</strong> হিসেবে যোগ দিতে আমন্ত্রণ জানিয়েছেন।</p>' +
      '<p>গ্রহণ করতে এই ইমেইল (বা আপনার ফোন) দিয়ে সাইন আপ বা সাইন ইন করুন।</p><p><a class="button" href="{{link}}">প্রতিষ্ঠানে যোগ দিন</a></p>' +
      '<p class="muted">{{link}}</p><p class="muted">এই আমন্ত্রণ ৭ দিন পর্যন্ত বৈধ।</p>',
  },

  // A test was scheduled for the student
  { event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: SMS, locale: 'en', subject: null, body: 'Upcoming test "{{exam_title}}" on {{exam_start_at}}. Please prepare. - Instructor' },
  { event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: SMS, locale: 'bn', subject: null, body: 'আসন্ন পরীক্ষা "{{exam_title}}", {{exam_start_at}}। প্রস্তুতি নিন। - Instructor' },

  // Platform admins: a workspace asked for a feature (FND-08)
  {
    event_type: NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED,
    channel: EMAIL,
    locale: 'en',
    subject: 'Feature request: {{feature}} from {{organization_name}}',
    body:
      '<h2>New feature request</h2><p><strong>{{user_name}}</strong> of <strong>{{organization_name}}</strong> asked for <strong>{{feature}}</strong>.</p>' +
      '<p>{{note}}</p><p><a class="button" href="{{link}}">Open feature requests</a></p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED,
    channel: EMAIL,
    locale: 'bn',
    subject: 'ফিচার অনুরোধ: {{organization_name}} থেকে {{feature}}',
    body:
      '<h2>নতুন ফিচার অনুরোধ</h2><p><strong>{{organization_name}}</strong>-এর <strong>{{user_name}}</strong> <strong>{{feature}}</strong> চেয়েছেন।</p>' +
      '<p>{{note}}</p><p><a class="button" href="{{link}}">ফিচার অনুরোধগুলো খুলুন</a></p>',
  },

  // The owner: 10% or less of the month's SMS credits left (FND-13)
  {
    event_type: NOTIFICATION_EVENTS.SMS_LOW_CREDIT,
    channel: EMAIL,
    locale: 'en',
    subject: 'SMS credits running low for {{organization_name}}',
    body:
      '<h2>Your SMS credits are running low</h2><p><strong>{{organization_name}}</strong> has <strong>{{credits_left}}</strong> SMS credits left this month.</p>' +
      '<p>When credits run out, SMS stop and are logged as "Not sent — no credit". In-app messages and emails still go out.</p>' +
      '<p><a class="button" href="{{link}}">Buy SMS credits</a></p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.SMS_LOW_CREDIT,
    channel: EMAIL,
    locale: 'bn',
    subject: '{{organization_name}}-এর SMS ক্রেডিট কমে আসছে',
    body:
      '<h2>আপনার SMS ক্রেডিট কমে আসছে</h2><p>এই মাসে <strong>{{organization_name}}</strong>-এর <strong>{{credits_left}}</strong>টি SMS ক্রেডিট বাকি আছে।</p>' +
      '<p>ক্রেডিট শেষ হলে SMS যাওয়া বন্ধ হবে এবং "পাঠানো হয়নি — ক্রেডিট নেই" হিসেবে লগে থাকবে। অ্যাপের বার্তা ও ইমেইল যেতে থাকবে।</p>' +
      '<p><a class="button" href="{{link}}">SMS ক্রেডিট কিনুন</a></p>',
  },
];

/** Values shown translated when a variable holds one of these codes (e.g. a member role). */
export const VALUE_LABELS: Record<NotificationLocale, Record<string, string>> = {
  en: { OWNER: 'owner', ADMIN: 'admin', TEACHER: 'teacher', STUDENT: 'student', ASSISTANT: 'staff member' },
  bn: { OWNER: 'মালিক', ADMIN: 'অ্যাডমিন', TEACHER: 'শিক্ষক', STUDENT: 'শিক্ষার্থী', ASSISTANT: 'স্টাফ' },
};
