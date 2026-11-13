import { NOTIFICATION_EVENTS, NotificationChannelEnum, NotificationLocale } from './notification.constants';

export interface DefaultTemplate {
  event_type: string;
  channel: NotificationChannelEnum;
  locale: NotificationLocale;
  subject: string | null;
  body: string;
}

const { SMS, EMAIL, IN_APP } = NotificationChannelEnum;

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
    channel: SMS,
    locale: 'en',
    subject: null,
    body: '{{inviter_name}} added you to {{class_name}} on Instructor. Sign up with this number to join: {{link}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.CLASS_INVITATION,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{inviter_name}} আপনাকে Instructor-এ {{class_name}} ক্লাসে যোগ করেছেন। যোগ দিতে এই নম্বর দিয়ে সাইন আপ করুন: {{link}}',
  },
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

  // In-app (the bell): the subject is the title.
  { event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: IN_APP, locale: 'en', subject: 'New test: {{exam_title}}', body: 'Starts {{exam_start_at}}.' },
  { event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED, channel: IN_APP, locale: 'bn', subject: 'নতুন পরীক্ষা: {{exam_title}}', body: 'শুরু {{exam_start_at}}।' },
  {
    event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
    channel: EMAIL,
    locale: 'en',
    subject: 'New test: {{exam_title}}',
    body: '<h2>Upcoming test</h2><p><strong>{{exam_title}}</strong> starts {{exam_start_at}}. Please prepare.</p>',
  },
  {
    event_type: NOTIFICATION_EVENTS.EXAM_SCHEDULED,
    channel: EMAIL,
    locale: 'bn',
    subject: 'নতুন পরীক্ষা: {{exam_title}}',
    body: '<h2>আসন্ন পরীক্ষা</h2><p><strong>{{exam_title}}</strong> শুরু {{exam_start_at}}। প্রস্তুতি নিন।</p>',
  },
  { event_type: NOTIFICATION_EVENTS.SMS_LOW_CREDIT, channel: IN_APP, locale: 'en', subject: 'SMS credits running low', body: '{{credits_left}} SMS credits left this month for {{organization_name}}.' },
  { event_type: NOTIFICATION_EVENTS.SMS_LOW_CREDIT, channel: IN_APP, locale: 'bn', subject: 'SMS ক্রেডিট কমে আসছে', body: 'এই মাসে {{organization_name}}-এর {{credits_left}}টি SMS ক্রেডিট বাকি।' },
  { event_type: NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED, channel: IN_APP, locale: 'en', subject: 'Feature request: {{feature}}', body: '{{user_name}} of {{organization_name}} asked for it.' },
  { event_type: NOTIFICATION_EVENTS.FEATURE_REQUEST_CREATED, channel: IN_APP, locale: 'bn', subject: 'ফিচার অনুরোধ: {{feature}}', body: '{{organization_name}}-এর {{user_name}} এটি চেয়েছেন।' },

  // One class cancelled or restored by its teacher or an admin (ATT-19), to the section's students in-app
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CANCELLED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Class cancelled: {{class_name}}',
    body: 'The {{start_time}} class on {{class_on}} is cancelled. {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CANCELLED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ক্লাস বাতিল: {{class_name}}',
    body: '{{class_on}} তারিখের {{start_time}}-এর ক্লাস বাতিল। {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_RESTORED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Class back on: {{class_name}}',
    body: 'The {{start_time}} class on {{class_on}} will take place after all.',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_RESTORED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ক্লাস হবে: {{class_name}}',
    body: '{{class_on}} তারিখের {{start_time}}-এর ক্লাস হবে।',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CHANGED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Class changed: {{class_name}}',
    body: 'On {{class_on}} the class is at {{start_time}}–{{end_time}}. Teacher: {{teacher_name}}. {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_CLASS_CHANGED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ক্লাসে পরিবর্তন: {{class_name}}',
    body: '{{class_on}} তারিখে ক্লাস {{start_time}}–{{end_time}}। শিক্ষক: {{teacher_name}}। {{note}}',
  },

  // Guardian SMS (ATT-06 late at once, ATT-10 absent once a day), short to fit one SMS
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LATE,
    channel: SMS,
    locale: 'en',
    subject: null,
    body: '{{student_name}} ({{class_name}}) checked in late at {{checked_in_at}}. {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LATE,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{student_name}} ({{class_name}}) {{checked_in_at}}-এ দেরিতে এসেছে। {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_ABSENT,
    channel: SMS,
    locale: 'en',
    subject: null,
    body: '{{student_name}} ({{class_name}}) was absent from class on {{absent_on}}. {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_ABSENT,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{student_name}} ({{class_name}}) {{absent_on}} তারিখে ক্লাসে অনুপস্থিত ছিল। {{organization_name}}',
  },

  // Repeated absence (ATT-14), in-app to the class teacher
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_REPEAT_ABSENCE,
    channel: IN_APP,
    locale: 'en',
    subject: 'Absent {{days}} days in a row: {{student_name}}',
    body: '{{student_name}} ({{class_name}}) has missed every class since {{since_on}}. Please follow up.',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_REPEAT_ABSENCE,
    channel: IN_APP,
    locale: 'bn',
    subject: 'টানা {{days}} দিন অনুপস্থিত: {{student_name}}',
    body: '{{student_name}} ({{class_name}}) {{since_on}} থেকে সব ক্লাসে অনুপস্থিত। খোঁজ নিন।',
  },

  // Leave (ATT-09, ATT-11): the guardian's SMS as soon as a student's leave is applied for
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPLIED,
    channel: SMS,
    locale: 'en',
    subject: null,
    body: 'Leave applied for {{student_name}} ({{class_name}}) from {{from_on}} to {{to_on}}. {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPLIED,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{student_name}} ({{class_name}})-এর জন্য {{from_on}} থেকে {{to_on}} পর্যন্ত ছুটির আবেদন করা হয়েছে। {{organization_name}}',
  },
  // In-app: a new request to its approvers, the decision to the person (and whoever applied for them)
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REQUESTED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Leave request: {{person_name}}',
    body: '{{person_name}} {{class_name}} asks for leave from {{from_on}} to {{to_on}}.',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REQUESTED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ছুটির আবেদন: {{person_name}}',
    body: '{{person_name}} {{class_name}} {{from_on}} থেকে {{to_on}} পর্যন্ত ছুটি চেয়েছে।',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPROVED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Leave approved: {{person_name}}',
    body: 'Leave from {{from_on}} to {{to_on}} is approved. {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_APPROVED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ছুটি মঞ্জুর: {{person_name}}',
    body: '{{from_on}} থেকে {{to_on}} পর্যন্ত ছুটি মঞ্জুর হয়েছে। {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REJECTED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Leave not approved: {{person_name}}',
    body: 'Leave from {{from_on}} to {{to_on}} was not approved. {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_REJECTED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ছুটি মঞ্জুর হয়নি: {{person_name}}',
    body: '{{from_on}} থেকে {{to_on}} পর্যন্ত ছুটি মঞ্জুর হয়নি। {{note}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_CANCELLED,
    channel: IN_APP,
    locale: 'en',
    subject: 'Leave withdrawn: {{person_name}}',
    body: 'The leave from {{from_on}} to {{to_on}} was withdrawn by {{by_name}}.',
  },
  {
    event_type: NOTIFICATION_EVENTS.ATTENDANCE_LEAVE_CANCELLED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'ছুটি প্রত্যাহার: {{person_name}}',
    body: '{{from_on}} থেকে {{to_on}} পর্যন্ত ছুটি {{by_name}} প্রত্যাহার করেছেন।',
  },
  // Homework review (HW-04, HW-06): in the inbox; the guardians' SMS for missing work uses credits.
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_RETURNED, channel: IN_APP, locale: 'en', subject: 'Homework returned for redo: {{title}}', body: 'Hand it in again. {{note}}' },
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_RETURNED, channel: IN_APP, locale: 'bn', subject: 'হোমওয়ার্ক আবার করতে ফেরত: {{title}}', body: 'আবার জমা দিন। {{note}}' },
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_SCORES_PUBLISHED, channel: IN_APP, locale: 'en', subject: 'Homework scored: {{title}}', body: 'Your score and feedback are ready.' },
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_SCORES_PUBLISHED, channel: IN_APP, locale: 'bn', subject: 'হোমওয়ার্কে নম্বর দেওয়া হয়েছে: {{title}}', body: 'আপনার নম্বর ও মন্তব্য দেখুন।' },
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_REMINDER, channel: IN_APP, locale: 'en', subject: 'Hand in your homework: {{title}}', body: 'Due {{due_at}}' },
  { event_type: NOTIFICATION_EVENTS.HOMEWORK_REMINDER, channel: IN_APP, locale: 'bn', subject: 'হোমওয়ার্ক জমা দিন: {{title}}', body: 'জমা {{due_at}}' },
  // Calendar events (P5-05, CAL-03, CAL-06)
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_ADDED, channel: IN_APP, locale: 'en', subject: 'New event: {{title}}', body: '{{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_ADDED, channel: IN_APP, locale: 'bn', subject: 'নতুন ইভেন্ট: {{title}}', body: '{{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_CHANGED, channel: IN_APP, locale: 'en', subject: 'Event changed: {{title}}', body: 'Now {{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_CHANGED, channel: IN_APP, locale: 'bn', subject: 'ইভেন্টে পরিবর্তন: {{title}}', body: 'এখন {{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_CANCELLED, channel: IN_APP, locale: 'en', subject: 'Event cancelled: {{title}}', body: 'It was on {{starts_at}}. {{note}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_EVENT_CANCELLED, channel: IN_APP, locale: 'bn', subject: 'ইভেন্ট বাতিল: {{title}}', body: '{{starts_at}}-এ হওয়ার কথা ছিল। {{note}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_REMINDER, channel: IN_APP, locale: 'en', subject: 'Reminder: {{title}}', body: 'Starts {{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_REMINDER, channel: IN_APP, locale: 'bn', subject: 'মনে করিয়ে দেওয়া: {{title}}', body: 'শুরু {{starts_at}} {{place}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_REMINDER, channel: SMS, locale: 'en', subject: null, body: 'Reminder: {{title}} starts {{starts_at}}. {{place}} - {{organization_name}}' },
  { event_type: NOTIFICATION_EVENTS.CALENDAR_REMINDER, channel: SMS, locale: 'bn', subject: null, body: 'মনে করিয়ে দেওয়া: {{title}} শুরু {{starts_at}}। {{place}} - {{organization_name}}' },
  // Proctoring alerts (P8-03, PRO-08): to the teacher, linked to the live monitor (`path`).
  { event_type: NOTIFICATION_EVENTS.PROCTORING_ALERT, channel: IN_APP, locale: 'en', subject: 'Check {{student_name}}', body: '{{flags}} flags in {{exam_name}}.' },
  { event_type: NOTIFICATION_EVENTS.PROCTORING_ALERT, channel: IN_APP, locale: 'bn', subject: '{{student_name}}-কে দেখুন', body: '{{exam_name}}-এ {{flags}}টি ফ্ল্যাগ।' },
  // Attempt reviews (P8-04, PRO-05): to the student; the decision code is shown by its label below.
  { event_type: NOTIFICATION_EVENTS.EXAM_REVIEW_DECIDED, channel: IN_APP, locale: 'en', subject: '{{exam_name}}: your attempt was reviewed', body: '{{decision}}. {{reason}}' },
  { event_type: NOTIFICATION_EVENTS.EXAM_REVIEW_DECIDED, channel: IN_APP, locale: 'bn', subject: '{{exam_name}}: আপনার পরীক্ষা পর্যালোচনা করা হয়েছে', body: '{{decision}}। {{reason}}' },
  // Group chat announcements (P9-01, COM-03): to the group's members, linked to the chat (`path`).
  { event_type: NOTIFICATION_EVENTS.CHAT_ANNOUNCEMENT, channel: IN_APP, locale: 'en', subject: '{{group}}: new announcement', body: '{{author}}: {{preview}}' },
  { event_type: NOTIFICATION_EVENTS.CHAT_ANNOUNCEMENT, channel: IN_APP, locale: 'bn', subject: '{{group}}: নতুন ঘোষণা', body: '{{author}}: {{preview}}' },
  { event_type: NOTIFICATION_EVENTS.CHAT_DIRECT_MESSAGE, channel: IN_APP, locale: 'en', subject: 'Message from {{author}}', body: '{{preview}}' },
  { event_type: NOTIFICATION_EVENTS.CHAT_DIRECT_MESSAGE, channel: IN_APP, locale: 'bn', subject: '{{author}}-এর বার্তা', body: '{{preview}}' },
  // Report cards (P7-04, PRF-09): to guardians, with the link that needs no login.
  {
    event_type: NOTIFICATION_EVENTS.REPORT_CARD_SHARED,
    channel: SMS,
    locale: 'en',
    subject: null,
    body: "{{student_name}}'s report card ({{term}}): {{score}}. See it here for 30 days: {{link}} - {{organization_name}}",
  },
  {
    event_type: NOTIFICATION_EVENTS.REPORT_CARD_SHARED,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{student_name}}-এর রিপোর্ট কার্ড ({{term}}): {{score}}। ৩০ দিন দেখা যাবে: {{link}} - {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_MISSING,
    channel: SMS,
    locale: 'en',
    subject: null,
    body: '{{student_name}} has not handed in the homework "{{title}}". - {{organization_name}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_MISSING,
    channel: SMS,
    locale: 'bn',
    subject: null,
    body: '{{student_name}} "{{title}}" হোমওয়ার্ক জমা দেয়নি। - {{organization_name}}',
  },
  // Homework (HW-02): in the inbox, linked to the homework (`path`).
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED,
    channel: IN_APP,
    locale: 'en',
    subject: 'New homework: {{title}}',
    body: '{{subject_name}} · Due {{due_at}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_ASSIGNED,
    channel: IN_APP,
    locale: 'bn',
    subject: 'নতুন হোমওয়ার্ক: {{title}}',
    body: '{{subject_name}} · জমা {{due_at}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_DUE_SOON,
    channel: IN_APP,
    locale: 'en',
    subject: 'Homework due soon: {{title}}',
    body: '{{subject_name}} · Due {{due_at}}',
  },
  {
    event_type: NOTIFICATION_EVENTS.HOMEWORK_DUE_SOON,
    channel: IN_APP,
    locale: 'bn',
    subject: 'হোমওয়ার্ক জমার সময় আসছে: {{title}}',
    body: '{{subject_name}} · জমা {{due_at}}',
  },
];

/** Values shown translated when a variable holds one of these codes (e.g. a member role). */
export const VALUE_LABELS: Record<NotificationLocale, Record<string, string>> = {
  en: { OWNER: 'owner', ADMIN: 'admin', TEACHER: 'teacher', STUDENT: 'student', ASSISTANT: 'staff member', NO_DUE_DATE: 'any time', NO_TEACHER: 'as usual', REINSTATE: 'Your attempt counts as submitted', RETAKE: 'You may take the exam again', CONFIRM: 'The result stands' },
  bn: { OWNER: 'মালিক', ADMIN: 'অ্যাডমিন', TEACHER: 'শিক্ষক', STUDENT: 'শিক্ষার্থী', ASSISTANT: 'স্টাফ', NO_DUE_DATE: 'যেকোনো সময়', NO_TEACHER: 'যথারীতি', REINSTATE: 'আপনার পরীক্ষা জমা হিসেবে গণ্য হবে', RETAKE: 'আপনি আবার পরীক্ষা দিতে পারবেন', CONFIRM: 'ফলাফল বহাল থাকছে' },
};
