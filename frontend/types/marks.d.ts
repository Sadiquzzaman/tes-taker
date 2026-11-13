/** Paper exams and their marks (P7-01, PRF-03): `GET /offline-exams`, `/offline-exams/:id/marks`. */
interface PaperExamPart {
  name: string;
  marks: number;
}

interface PaperExam {
  id: string;
  name: string;
  exam_date: string;
  total_marks: number;
  parts: PaperExamPart[] | null;
  session_id: string;
  term: { id: string; name: string } | null;
  offering: { id: string; subject: { id: string; name: string }; section: { id: string; name: string; class_name: string | null } };
  published_at: string | null;
  counts: { students: number; entered: number };
  can_edit: boolean;
}

interface PaperMarkRow {
  student: { id: string; full_name: string; roll_no: string | null };
  marks: number | null;
  part_marks: Record<string, number> | null;
  is_absent: boolean;
  percent: number | null;
  grade: { grade: string; gpa: number | null } | null;
}

interface PaperMarksGrid {
  exam: PaperExam;
  rows: PaperMarkRow[];
}

/** What the marks grid sends (`PUT /offline-exams/:id/marks`). */
interface PaperMarkInput {
  student_id: string;
  marks?: number | null;
  part_marks?: Record<string, number> | null;
  is_absent?: boolean;
}

/** A subject class paper exams can be added to (`GET /offline-exams/subject-classes`). */
interface PaperSubjectClass {
  offering_id: string;
  session_id: string;
  section_label: string;
  subject: { id: string; name: string };
  terms: { id: string; name: string; start_date: string | null; end_date: string | null }[];
}

/** A student's published result (`GET /offline-exams/mine`). */
interface MyPaperResult {
  exam: { id: string; name: string; exam_date: string; total_marks: number; parts: PaperExamPart[] | null; term: { id: string; name: string } | null; subject: { id: string; name: string } };
  marks: number | null;
  part_marks: Record<string, number> | null;
  is_absent: boolean;
  percent: number | null;
  grade: { grade: string; gpa: number | null } | null;
}
