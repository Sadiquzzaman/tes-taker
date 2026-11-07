/**
 * Every action the audit log records (design §8.10), named `<area>.<verb>`. Add new ones here
 * (and their names in the web app's `audit.actions` messages, en + bn) when a feature starts
 * recording; `action` is varchar(80), so no migration is needed.
 */
export const AUDIT_ACTIONS = {
  // Plans and entitlements (platform admin, design §8.3)
  PLAN_CREATE: 'plan.create',
  PLAN_UPDATE: 'plan.update',
  PLAN_DELETE: 'plan.delete',
  PLAN_REORDER: 'plan.reorder',
  PLAN_ACTIVATE: 'plan.activate',
  PLAN_DEACTIVATE: 'plan.deactivate',
  SUBSCRIPTION_PLAN_ASSIGN: 'subscription.plan_assign',
  SUBSCRIPTION_CANCEL: 'subscription.cancel',
  SUBSCRIPTION_OVERRIDE_SET: 'subscription.override_set',
  SUBSCRIPTION_OVERRIDE_REMOVE: 'subscription.override_remove',
  PAYMENT_CONFIRM: 'payment.confirm',
  FEATURE_REQUEST_HANDLED: 'feature_request.handled',

  // Accounts (platform admin)
  ORGANIZATION_APPROVE: 'organization.approve',
  ORGANIZATION_REJECT: 'organization.reject',
  TEACHER_REQUEST_APPROVE: 'teacher_request.approve',
  TEACHER_REQUEST_REJECT: 'teacher_request.reject',
  USER_ROLE_CHANGE: 'user.role_change',
  TEACHER_STATUS_CHANGE: 'teacher.status_change',

  // Organisation members (owner and admins)
  MEMBER_ADD: 'member.add',
  MEMBER_ROLE_CHANGE: 'member.role_change',
  MEMBER_REMOVE: 'member.remove',

  // Guardians (owners, admins, assistants and the student's teachers, FND-09)
  GUARDIAN_CREATE: 'guardian.create',
  GUARDIAN_UPDATE: 'guardian.update',
  GUARDIAN_DELETE: 'guardian.delete',

  // Students (owners, admins and assistants, FND-04)
  STUDENT_IMPORT: 'student.import',

  // Results (design §8.11: grade changes are traced)
  EXAM_RESULTS_PUBLISH: 'exam.results_publish',
  GRADE_UPDATE: 'grade.update',

  // Grading scale (owner and admins, FND-11)
  GRADING_SCALE_UPDATE: 'grading_scale.update',
  GRADING_SCALE_RESET: 'grading_scale.reset',

  // Attendance settings and holidays (owner and admins, ATT-01, CAL-04)
  ATTENDANCE_SETTINGS_UPDATE: 'attendance_settings.update',
  HOLIDAY_CREATE: 'holiday.create',
  HOLIDAY_UPDATE: 'holiday.update',
  HOLIDAY_REMOVE: 'holiday.remove',

  // Branches with their check-in pin and radius (owner and admins, ATT-15)
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_REMOVE: 'branch.remove',

  // Section attendance setup and schedules (owner, admins, assistants; teachers for their sections; ATT-16)
  SECTION_ATTENDANCE_UPDATE: 'section_attendance.update',
  SCHEDULE_UPDATE: 'schedule.update',

  // Attendance corrections (owners, admins, assistants; teachers for their classes; ATT-07, ATT-12)
  ATTENDANCE_CORRECT: 'attendance.correct',
  // Cancelling and restoring one class (teachers of the section, owners, admins; ATT-19)
  ATTENDANCE_CANCEL: 'attendance.cancel',
  ATTENDANCE_RESTORE: 'attendance.restore',
  ATTENDANCE_CHANGE: 'attendance.change',
  // The closing job's Absent records, counted per organisation and run (system, ATT-10)
  ATTENDANCE_AUTO_ABSENT: 'attendance.auto_absent',
  // A paper register imported for a section and month (its teachers, owners, admins; ATT-17)
  ATTENDANCE_IMPORT: 'attendance.import',
  // Leave requests (students, teachers and approvers; ATT-09, ATT-11)
  LEAVE_APPLY: 'leave.apply',
  LEAVE_APPROVE: 'leave.approve',
  LEAVE_REJECT: 'leave.reject',
  LEAVE_CANCEL: 'leave.cancel',

  // Homework (teachers and staff; HW-01)
  HOMEWORK_CREATE: 'homework.create',
  HOMEWORK_UPDATE: 'homework.update',
  HOMEWORK_PUBLISH: 'homework.publish',
  HOMEWORK_CANCEL: 'homework.cancel',
  HOMEWORK_SETTINGS_UPDATE: 'homework_settings.update',
  HOMEWORK_SCORE: 'homework.score',
  HOMEWORK_RETURN: 'homework.return',
  HOMEWORK_PUBLISH_SCORES: 'homework.publish_scores',
  HOMEWORK_REMIND: 'homework.remind',
  ROUTINE_ADD: 'routine.add',
  ROUTINE_CHANGE: 'routine.change',
  ROUTINE_REMOVE: 'routine.remove',
  EVENT_CREATE: 'event.create',
  EVENT_UPDATE: 'event.update',
  EVENT_CANCEL: 'event.cancel',
  REMINDERS_DEFAULTS_UPDATE: 'reminders.defaults_update',

  // Notifications (platform admin, design §8.6)
  MESSAGE_TEMPLATE_UPDATE: 'message_template.update',
  SMS_CREDITS_TOP_UP: 'sms_credits.top_up',

  // Files (FND-15, FND-16)
  FILE_UPLOAD: 'file.upload',
  FILE_DELETE: 'file.delete',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ALL_AUDIT_ACTIONS: AuditAction[] = Object.values(AUDIT_ACTIONS);
