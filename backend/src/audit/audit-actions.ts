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

  // Notifications (platform admin, design §8.6)
  MESSAGE_TEMPLATE_UPDATE: 'message_template.update',
  SMS_CREDITS_TOP_UP: 'sms_credits.top_up',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ALL_AUDIT_ACTIONS: AuditAction[] = Object.values(AUDIT_ACTIONS);
