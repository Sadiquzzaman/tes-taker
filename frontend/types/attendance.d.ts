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
  /** The subject set in the routine (P5-04). */
  subject?: { id: string; name: string } | null;
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
  /** The period's subject from the routine; null (or missing) for a whole-section class. */
  subject?: { id: string; name: string } | null;
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
  /** On approved leave today (P3-06): classes count as Leave unless they check in. */
  on_leave?: boolean;
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
      /** The period's subject from the routine; null (or missing) for a whole-section class. */
      subject?: { id: string; name: string } | null;
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
  /** The period's subject from the routine; null (or missing) for a whole-section class. */
  subject?: { id: string; name: string } | null;
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
  /** Set when the time or teacher was changed for that day (P5-04); `teacher` is then who teaches it. */
  change: ClassChange | null;
  can_correct: boolean;
  can_cancel: boolean;
  can_restore: boolean;
  /** Times or teacher can be changed for that day: before check-in opens, nobody checked in (P5-04). */
  can_change: boolean;
}

/** A one-day change of a class (P5-04): the routine's times, the substitute, who changed it, when and the note. */
interface ClassChange {
  routine_start_time: string;
  routine_end_time: string;
  substitute: { id: string; full_name: string } | null;
  at: string | null;
  by: { id: string; full_name: string } | null;
  note: string | null;
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

/** Leave requests (ATT-09, ATT-11; messages `leave`). */
type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** A leave request as `/attendance/leave` returns it. */
interface LeaveRequest {
  id: string;
  person: { id: string; full_name: string };
  person_type: "STUDENT" | "TEACHER";
  /** Students: "Class 8 A"; empty for teachers. */
  class_name: string;
  from_date: string;
  to_date: string;
  /** Days in the range that are not a weekly off day or holiday. */
  school_days: number;
  reason: string;
  file: { id: string; name: string | null; mime: string } | null;
  status: LeaveStatus;
  applied_by: { id: string; full_name: string } | null;
  decided_by: { id: string; full_name: string } | null;
  decided_at: string | null;
  decision_note: string | null;
  cancelled_by: { id: string; full_name: string } | null;
  cancelled_at: string | null;
  created_at: string;
  can_decide: boolean;
  can_cancel: boolean;
}

/** `GET /attendance/leave/mine`. */
interface MyLeave {
  today: string;
  can_apply: boolean;
  person_type: "STUDENT" | "TEACHER" | null;
  can_apply_for_others: boolean;
  can_approve: boolean;
  requests: LeaveRequest[];
}

/** `GET /attendance/leave/people`: whom the caller may apply for. */
interface LeavePeople {
  students: { id: string; full_name: string; class_name: string }[];
  staff: { id: string; full_name: string; role: OrganizationMemberRole }[];
}

/** `GET /attendance/register/sections` (ATT-17): sections whose register the caller may download. */
interface PaperRegisterSection {
  id: string;
  name: string;
  class_name: string;
  mode: SectionAttendanceMode;
}

/** `GET /attendance/register/sections/:id?month=`: the template and the export (ATT-13, same format). */
interface PaperRegisterView {
  section: { id: string; name: string; class_name: string };
  month: string;
  today: string;
  mode: SectionAttendanceMode;
  can_import: boolean;
  /** The class-day columns: `header` is the date, plus the start time when the day has two classes. */
  classes: { header: string; date: string; start_time: string; end_time: string; slot_id: string }[];
  /** Marks in `classes` order; null = nothing recorded. */
  students: { id: string; full_name: string; roll_no: string | null; marks: (AttendanceStatus | null)[] }[];
}

type PaperRegisterIssue =
  | "COLUMN_UNKNOWN"
  | "COLUMN_NOT_IN_MONTH"
  | "NOT_CLASS_DAY"
  | "CLOSED_DAY"
  | "CANCELLED"
  | "NOT_STARTED"
  | "TIME_NEEDED"
  | "NOT_CLASS_TIME"
  | "DUPLICATE_COLUMN"
  | "STUDENT_MISSING"
  | "STUDENT_NOT_FOUND"
  | "STUDENT_AMBIGUOUS"
  | "STUDENT_DUPLICATE"
  | "STATUS_INVALID"
  | "NOT_JOINED"
  | "TOO_OLD";
type PaperRegisterNote = "NAME_DIFFERS" | "SELF_CHECKIN" | "LEAVE_KEPT" | "ON_LEAVE";

interface PaperRegisterCell {
  column: number;
  value: string;
  status: AttendanceStatus | null;
  old_status: AttendanceStatus | null;
  change: "NEW" | "CHANGE" | "SAME" | "KEEP" | null;
  issues: PaperRegisterIssue[];
  notes: PaperRegisterNote[];
}

/** `POST /attendance/register/sections/:id/preview` and `/import`: the file checked column by column, row by row, cell by cell. */
interface PaperRegisterPreview {
  section: { id: string; name: string; class_name: string };
  month: string;
  /** Nothing with marks has a problem: the file can be imported. */
  valid: boolean;
  columns: { column: number; header: string; date: string | null; start_time: string | null; closed: ClosedDay["reason"] | null; marks: number; issues: PaperRegisterIssue[] }[];
  rows: {
    row: number;
    roll_no: string | null;
    name: string | null;
    student: { id: string; full_name: string; roll_no: string | null } | null;
    marks: number;
    issues: PaperRegisterIssue[];
    notes: PaperRegisterNote[];
    cells: PaperRegisterCell[];
  }[];
  /** `check_ins`: self check-ins the file disagrees with (replaced only when asked). */
  summary: { new: number; changed: number; unchanged: number; kept: number; check_ins: number };
}

/** Counts of classes per mark (ATT-13, ATT-18). */
interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  leave: number;
}

/** A person's day in the reports: Absent = missed every class held; `missed` = classes missed on a day they attended others. */
type ReportDayStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "WAITING";
interface ReportDayMark {
  status: ReportDayStatus;
  missed: number;
  waiting: number;
}

/** `GET /attendance/reports/daily` (ATT-13): the daily summary per section. */
interface DailyAttendanceReport {
  date: string;
  today: string;
  time_zone: string;
  closed: ClosedDay | null;
  sections: {
    section: { id: string; name: string; class_name: string };
    mode: SectionAttendanceMode;
    classes: {
      slot_id: string;
      start_time: string;
      end_time: string;
      teacher: { id: string; full_name: string } | null;
      state: "UPCOMING" | "OPEN" | "CLOSED";
      cancelled: boolean;
      counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; flagged: number };
    }[];
    counts: { students: number; present: number; late: number; absent: number; leave: number; waiting: number; missed_some: number };
    students: { id: string; full_name: string; roll_no: string | null; marks: (CalendarStatus | null)[]; day: ReportDayMark | null }[];
  }[];
}

/** `GET /attendance/reports/sections/:id/month` (ATT-13): the register with day marks, counts and %. */
interface MonthlyAttendanceReport extends Omit<PaperRegisterView, "students"> {
  days: { date: string; classes: number }[];
  students: (PaperRegisterView["students"][number] & { days: (ReportDayMark | null)[]; counts: AttendanceCounts; attendance_pct: number | null })[];
  counts: AttendanceCounts;
  attendance_pct: number | null;
}

/** `GET /attendance/reports/teachers` (ATT-11, ATT-13): owners and admins. */
interface TeacherAttendanceReport {
  from: string;
  to: string;
  today: string;
  teachers: {
    teacher: { id: string; full_name: string };
    counts: AttendanceCounts;
    attendance_pct: number | null;
    late_minutes: number;
    classes: { date: string; section: { id: string; name: string; class_name: string }; start_time: string; end_time: string; status: AttendanceStatus; late_minutes: number | null }[];
  }[];
}
