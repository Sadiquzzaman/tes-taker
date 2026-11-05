/**
 * UNUSED since P3-02 (class-based design); kept for the org_settings column until it is dropped.
 *
 * How an organisation records daily presence (ATT-01, schema.dbml `attendance_method`). Only one is
 * active at a time. WEB is students and teachers checking in on the website (owner decision,
 * 2 Nov 2026: web first); ZKTECO (ATT-02/03) and APP (ATT-04/05) come later and cannot be chosen yet.
 */
export enum AttendanceMethodEnum {
  OFF = 'OFF',
  WEB = 'WEB',
  ZKTECO = 'ZKTECO',
  APP = 'APP',
}

