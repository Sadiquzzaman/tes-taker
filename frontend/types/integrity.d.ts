/** Plagiarism checks (Epic 10, P10-09). */
type SimilarityScope = "HOMEWORK" | "IELTS_WRITING";
type SimilarityLevel = "HIGH" | "MEDIUM" | "LOW";
type NotChecked = "TOO_SHORT" | "NO_TEXT" | "HANDWRITTEN_IMAGE" | "FILE_NOT_READ";

interface PersonRef {
  id: string;
  full_name: string;
}

/** `GET /integrity/checks/latest`, `POST /integrity/checks` */
interface SimilarityReportData {
  check: { id: string; ran_at: string; ran_by: string | null; submissions: number } | null;
  thresholds: { high: number; medium: number; min_words: number };
  submissions: {
    submission_id: string;
    student: PersonRef;
    part_no: number | null;
    words: number;
    not_checked: NotChecked | null;
    percent: number;
    level: SimilarityLevel | null;
    most_similar: { match_id: string; student: PersonRef; percent: number }[];
  }[];
  matches: {
    id: string;
    part_no: number | null;
    a: { student: PersonRef; percent: number };
    b: { student: PersonRef; percent: number };
    score: number;
    level: SimilarityLevel;
    review_decision: "OK" | "COPIED" | null;
    review_note: string | null;
  }[];
}

/** `GET /integrity/matches/:id` */
interface SimilarityMatchView {
  id: string;
  part_no: number | null;
  level: SimilarityLevel;
  score: number;
  a: { student: PersonRef; text: string; spans: { start: number; end: number }[]; percent: number };
  b: { student: PersonRef; text: string; spans: { start: number; end: number }[]; percent: number };
  review_decision: "OK" | "COPIED" | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}
