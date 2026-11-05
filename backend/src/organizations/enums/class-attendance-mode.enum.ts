/**
 * UNUSED since P3-02 (class-based design); kept for the org_settings column until it is dropped.
 * How teachers took class attendance (ATT-01, ATT-07; schema.dbml `class_attendance_mode`).
 */
export enum ClassAttendanceModeEnum {
  OFF = 'OFF',
  /** A roll call for every class session (section + subject + date). */
  PER_SESSION = 'PER_SESSION',
  /** One roll call per section per day. */
  DAILY = 'DAILY',
}
