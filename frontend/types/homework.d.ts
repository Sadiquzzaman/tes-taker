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
