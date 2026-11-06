/** `GET /attendance/settings` (ATT-01 as changed on 5 Nov 2026); days are ISO (1 = Monday … 7 = Sunday). */
interface AttendanceSettings {
  /** Minutes after a class starts before a check-in is Late; a section can override it. */
  late_grace_minutes: number;
  weekly_off_days: number[];
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

/** `GET /attendance/branches` (ATT-15). The main (default) branch comes first; its name may be null. */
interface Branch {
  id: string;
  name: string | null;
  address: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  checkin_radius_m: number;
  is_default: boolean;
  /** Sections of open sessions that meet here. */
  section_count: number;
}

type SectionClassType = "IN_PERSON" | "ONLINE";
type SectionAttendanceMode = "SELF_CHECKIN" | "PAPER_REGISTER";

/** A weekly slot of a section (ATT-16): ISO day, "HH:MM" times, an optional teacher. */
interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  teacher_id: string | null;
  teacher: { id: string; full_name: string } | null;
}

/** One row of `GET /attendance/setup`. */
interface SectionSetup {
  id: string;
  name: string;
  class: { id: string; name: string };
  shift: "MORNING" | "DAY" | "EVENING" | null;
  /** The main branch's id when the section has none of its own. */
  branch_id: string;
  class_type: SectionClassType;
  mode: SectionAttendanceMode;
  /** null = the organisation's grace period. */
  grace_minutes: number | null;
  slots: ScheduleSlot[];
  can_edit: boolean;
}

/** `GET /attendance/setup`. */
interface ClassSetup {
  session: { id: string; name: string; status: string };
  late_grace_minutes: number;
  main_branch_id: string;
  /** May move sections between branches and apply a schedule to a class or shift. */
  can_manage: boolean;
  sections: SectionSetup[];
}

/** `POST /attendance/setup/apply`. */
interface ApplyScheduleResult {
  dry_run: boolean;
  sections: { id: string; name: string; class_name: string; slots_before: number; teachers_dropped: number }[];
}

/** Why a schedule CSV row cannot be used (messages `classSetup.import.issues`). */
type ScheduleImportIssue =
  | "CLASS_MISSING"
  | "CLASS_NOT_FOUND"
  | "SECTION_MISSING"
  | "SECTION_NOT_FOUND"
  | "NAME_AMBIGUOUS"
  | "NOT_YOUR_SECTION"
  | "DAYS_INVALID"
  | "START_INVALID"
  | "END_INVALID"
  | "END_BEFORE_START"
  | "OVERLAP"
  | "TOO_MANY"
  | "CLASS_TYPE_INVALID"
  | "MODE_INVALID"
  | "GRACE_INVALID"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_NOT_ALLOWED"
  | "SETTINGS_CONFLICT";

/** One checked row of a schedule CSV (`POST /attendance/setup/import/preview`); `row` is its line in the file. */
interface ScheduleImportRowResult {
  row: number;
  class: string | null;
  section: string | null;
  days: number[];
  start: string | null;
  end: string | null;
  errors: ScheduleImportIssue[];
}

interface ScheduleImportPreview {
  session: { id: string; name: string };
  /** No row has a problem; only then can the file be imported. */
  valid: boolean;
  rows: ScheduleImportRowResult[];
  sections: { id: string; name: string; class_name: string; slots_before: number; slots_after: number; settings_changed: boolean }[];
}

/** A person's attendance in a class session (P3-03). */
type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE";

/** A saved record as the API returns it (never the position). */
interface AttendanceRecord {
  id: string;
  status: AttendanceStatus;
  checked_in_at: string | null;
  late_minutes: number | null;
  source: "SELF" | "AUTO_ABSENT" | "IMPORT" | "CORRECTION";
  distance_m: number | null;
  accuracy_m: number | null;
  flag: "EDGE_ACCURACY" | "IMPOSSIBLE_JUMP" | null;
}

/** One of the caller's classes today (`GET /attendance/me/today`, ATT-04). Times are ISO instants from the server. */
interface MyClass {
  slot_id: string;
  date: string;
  role: "STUDENT" | "TEACHER";
  section: { id: string; name: string; class_name: string };
  class_type: SectionClassType;
  mode: SectionAttendanceMode;
  start_time: string;
  end_time: string;
  opens_at: string;
  starts_at: string;
  late_after: string;
  ends_at: string;
  state: "UPCOMING" | "OPEN" | "CLOSED";
  needs_location: boolean;
  blocked: "CLOSED_DAY" | "CANCELLED" | "PAPER_REGISTER" | "NO_PIN" | null;
  can_check_in: boolean;
  record: AttendanceRecord | null;
}

/** A weekly off day or holiday (from the server). */
interface ClosedDay {
  date: string;
  reason: "WEEKLY_OFF" | "HOLIDAY";
  holiday_name?: string | null;
}

/** `GET /attendance/me/today`. */
interface MyToday {
  date: string;
  server_time: string;
  time_zone: string;
  closed: ClosedDay | null;
  classes: MyClass[];
}

/** A class on the calendar, in the colours of spec Epic 1 (messages `myAttendance.status`). */
type CalendarStatus = "UPCOMING" | "OPEN" | AttendanceStatus | "CLOSED_DAY" | "CANCELLED" | "NOT_RECORDED";

/** `GET /attendance/me/calendar` (ATT-18). */
interface MyCalendar {
  month: string;
  today: string;
  time_zone: string;
  days: {
    date: string;
    closed: ClosedDay | null;
    classes: {
      slot_id: string;
      role: "STUDENT" | "TEACHER";
      section: { id: string; name: string; class_name: string };
      start_time: string;
      end_time: string;
      status: CalendarStatus;
      record: AttendanceRecord | null;
    }[];
  }[];
  counts: { present: number; late: number; absent: number; leave: number };
  attendance_pct: number | null;
}

/** A correction in a record's trail (ATT-12). */
interface AttendanceCorrection {
  id: string;
  old_status: AttendanceStatus | null;
  new_status: AttendanceStatus;
  reason: string;
  corrected_by: { id: string; full_name: string } | null;
  created_at: string;
}

/** A class on a date for staff (`GET /attendance/sessions`, ATT-07). */
interface ClassSessionSummary {
  slot_id: string;
  date: string;
  section: { id: string; name: string; class_name: string };
  start_time: string;
  end_time: string;
  class_type: SectionClassType;
  mode: SectionAttendanceMode;
  starts_at: string;
  late_after: string;
  ends_at: string;
  state: "UPCOMING" | "OPEN" | "CLOSED";
  closed: ClosedDay | null;
  teacher: { id: string; full_name: string } | null;
  counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; flagged: number };
  /** Set when the class was cancelled for that day (ATT-19). */
  cancelled: { at: string | null; by: { id: string; full_name: string } | null; note: string | null } | null;
  can_correct: boolean;
  can_cancel: boolean;
  can_restore: boolean;
}

/** One person on a class's list. */
interface ClassRosterRow {
  person: { id: string; full_name: string; roll_no: string | null };
  role: "STUDENT" | "TEACHER";
  status: CalendarStatus;
  record: AttendanceRecord | null;
  corrections: AttendanceCorrection[];
  can_correct: boolean;
}

/** `GET /attendance/sessions/:slotId/:date`. */
interface ClassSessionDetail extends ClassSessionSummary {
  students: ClassRosterRow[];
  teachers: ClassRosterRow[];
}

/** `GET /attendance/sessions`. */
interface ClassSessionsOnDate {
  date: string;
  today: string;
  time_zone: string;
  closed: ClosedDay | null;
  sessions: ClassSessionSummary[];
}
