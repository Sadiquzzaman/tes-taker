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
