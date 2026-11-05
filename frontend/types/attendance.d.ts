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
