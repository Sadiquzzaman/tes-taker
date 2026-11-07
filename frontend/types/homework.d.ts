/** Homework (Epic 2, P5-01): as the API returns it (`GET /homework`, `/homework/mine`, `/homework/:id`). */
type HomeworkType = "FILE" | "TEXT" | "PAPER";
type HomeworkStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CANCELLED";

interface HomeworkTarget {
  offering_id: string;
  /** "Class 6 A" */
  section_label: string;
  /** Chosen students; null = everyone taking the subject class (staff only; null for students). */
  student_ids: string[] | null;
}

interface HomeworkAttachment {
  id: string;
  name: string | null;
  mime: string | null;
  size_bytes: number | null;
  /** API path, e.g. /files/{id}/content */
  url: string;
}

interface HomeworkItem {
  id: string;
  title: string;
  /** `{ html }` from the editor, or null. */
  instructions: { html?: string } | null;
  submission_type: HomeworkType;
  total_marks: number | null;
  due_at: string | null;
  publish_at: string | null;
  published_at: string | null;
  status: HomeworkStatus;
  session_id: string;
  subject: { id: string; name: string };
  targets: HomeworkTarget[];
  attachments: HomeworkAttachment[];
  student_count: number;
  created_by: { id: string; full_name: string } | null;
  created_at: string;
  can_edit: boolean;
  /** Students: their latest hand-in, or null. */
  my_submission: { version: number; submitted_at: string; is_late: boolean; status: SubmissionStatus } | null;
}

/** What the editor sends (`POST /homework`, `PATCH /homework/:id`). */
interface HomeworkInput {
  title: string;
  instructions: { html: string } | null;
  submission_type: HomeworkType;
  total_marks: number | null;
  due_at: string | null;
  offering_ids: string[];
  student_ids?: string[];
  attachment_ids: string[];
}

/** A hand-in (P5-02, HW-03). */
type SubmissionStatus = "SUBMITTED" | "RETURNED" | "SCORED";

interface SubmissionItem {
  id: string;
  version: number;
  text_answer: string | null;
  submitted_at: string;
  is_late: boolean;
  late_minutes: number | null;
  status: SubmissionStatus;
  files: HomeworkAttachment[];
}

/** `GET /homework/:id/my-submissions` */
interface MySubmissions {
  submissions: SubmissionItem[];
  can_submit: boolean;
  blocked_by: string | null;
  submissions_left: number;
  late_now: boolean;
  max_files: number;
  /** The student's score, once the teacher has published scores (P5-03). */
  score: HomeworkScore | null;
}

/** `GET /homework/:id/submissions` (staff): one row per student. */
interface StudentSubmissionRow {
  student: { id: string; full_name: string; roll_no: string | null };
  versions: number;
  latest: { id: string; version: number; submitted_at: string; is_late: boolean; late_minutes: number | null; status: SubmissionStatus; file_count: number } | null;
}

/** `GET /homework/:id/submissions/:submissionId` (staff) */
type SubmissionDetail = SubmissionItem & { student: { id: string; full_name: string }; versions: SubmissionItem[] };

/** `GET|PATCH /homework/settings` */
interface HomeworkSettings {
  late_allowed: boolean;
  late_penalty: { type: "NONE" | "PER_DAY" | "FIXED"; percent: number };
  resubmissions: number;
  max_files: number;
}

/** 1–5 ratings a teacher may add to a score (P5-03, HW-05). */
interface HomeworkRatings {
  neatness?: number;
  effort?: number;
  on_time?: number;
}

/** A student's score on a homework (P5-03, HW-04, HW-05). */
interface HomeworkScore {
  raw_score: number | null;
  /** Taken off for handing in late. */
  penalty: number;
  final_score: number | null;
  total_marks: number | null;
  /** 0–100; null without a score or total. */
  percent: number | null;
  grade: { grade: string; gpa: number | null } | null;
  feedback: string | null;
  ratings: HomeworkRatings | null;
  /** Never handed in (paper homework). */
  is_missing: boolean;
  scored_at: string | null;
}

/** `GET /homework/:id/grid` (staff): everyone it is set to, their latest hand-in and score. */
interface HomeworkGrid {
  homework: { id: string; total_marks: number | null; submission_type: HomeworkType; due_at: string | null; scores_published_at: string | null };
  counts: { students: number; handed_in: number; late: number; missing: number; scored: number };
  rows: HomeworkGridRow[];
}

interface HomeworkGridRow {
  student: { id: string; full_name: string; roll_no: string | null };
  latest: { id: string; version: number; submitted_at: string; is_late: boolean; late_minutes: number | null; status: SubmissionStatus } | null;
  versions: number;
  score: HomeworkScore | null;
}

/** One row of `PUT /homework/:id/scores`. */
interface HomeworkScoreInput {
  student_id: string;
  raw_score?: number | null;
  feedback?: string | null;
  is_missing?: boolean;
  ratings?: HomeworkRatings | null;
}
