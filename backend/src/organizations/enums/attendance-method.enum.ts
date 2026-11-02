/**
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

/** Methods an organisation can choose today. */
export const AVAILABLE_ATTENDANCE_METHODS: AttendanceMethodEnum[] = [AttendanceMethodEnum.OFF, AttendanceMethodEnum.WEB];
