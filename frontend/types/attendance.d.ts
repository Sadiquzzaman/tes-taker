/** Daily presence method (ATT-01). Only OFF and WEB can be chosen today; ZKTECO and APP come later. */
type AttendanceMethod = "OFF" | "WEB" | "ZKTECO" | "APP";

/** How teachers take class attendance (ATT-07). */
type ClassAttendanceMode = "OFF" | "PER_SESSION" | "DAILY";

/** `GET /attendance/settings`. Times are "HH:MM" in the organisation's time zone; days are ISO (1 = Monday … 7 = Sunday). */
interface AttendanceSettings {
  attendance_method: AttendanceMethod;
  selfie_required: boolean;
  class_attendance_mode: ClassAttendanceMode;
  weekly_off_days: number[];
  student_entry_time: string;
  teacher_entry_time: string;
  guardian_sms: { late: boolean; absent: boolean; leave: boolean };
  repeat_absence_days: number;
}

/** A holiday or closure (CAL-04): school dates "YYYY-MM-DD", both included. */
interface Holiday {
  id: string;
  date_from: string;
  date_to: string;
  name: string | null;
  days: number;
}
