/** Score weights and performance settings (P7-02, PRF-01, PRF-07, PRF-10): `GET /scores/weights`, `/scores/settings`. */
interface ScoreWeightValues {
  exams_pct: number;
  homework_pct: number;
  attendance_pct: number;
  behaviour_pct: number;
}

interface SessionScoreWeights {
  session: { id: string; name: string; closed: boolean };
  default_weights: ScoreWeightValues;
  classes: { class: { id: string; name: string }; weights: ScoreWeightValues; is_default: boolean }[];
}

interface PerformanceSettings {
  at_risk: { score_pct: number; attendance_pct: number; missing_homework: number };
  show_rank: boolean;
}

/** Live scores (P7-02/P7-03, PRF-05–07, PRF-10): `GET /scores/sections/:id`, `/scores/students/:id`. */
type AtRiskReason = "SCORE" | "ATTENDANCE" | "MISSING_HOMEWORK";

interface ScoreLine {
  exams_pct: number | null;
  homework_pct: number | null;
  attendance_pct: number | null;
  behaviour_pct: number | null;
  score_pct: number | null;
  grade: { grade: string; gpa: number } | null;
  counts: { exams: number; homework: number; ratings: number };
}

interface SubjectScoreLine extends ScoreLine {
  subject: { id: string; name: string };
}

interface StudentScoreRow {
  student: { id: string; full_name: string; roll_no: string | null };
  overall: ScoreLine;
  subjects: SubjectScoreLine[];
  homework: { set: number; missing: number; late: number };
  missing_homework: number;
  at_risk: AtRiskReason[];
  position: number | null;
}

interface ScoreExamSummary {
  id: string;
  kind: "ONLINE" | "PAPER";
  name: string;
  date: string;
  subject_id: string | null;
  average_pct: number | null;
  taken: number;
}

interface SectionScores {
  section: { id: string; name: string; class_id: string; class_name: string; session_id: string };
  period: { from: string; to: string; term: { id: string; name: string } | null };
  weights: ScoreWeightValues & { is_default: boolean };
  thresholds: PerformanceSettings["at_risk"];
  subjects: { id: string; name: string }[];
  exams: ScoreExamSummary[];
  students: StudentScoreRow[];
}

interface VisibleScoreSections {
  session: { id: string; name: string; closed: boolean };
  terms: { id: string; name: string }[];
  sections: { id: string; name: string; class_name: string }[];
}

interface StudentPerformance {
  student: { id: string; full_name: string; roll_no: string | null };
  section: { id: string; name: string; class_name: string; session: { id: string; name: string; closed: boolean } };
  sections: { id: string; name: string; class_name: string; session: { id: string; name: string } }[];
  terms: { id: string; name: string }[];
  period: SectionScores["period"];
  weights: SectionScores["weights"];
  overall: ScoreLine;
  subjects: SubjectScoreLine[];
  position: number | null;
  class_size: number;
  at_risk: AtRiskReason[];
  attendance: { counts: { present: number; late: number; absent: number; leave: number }; attendance_pct: number | null };
  homework: StudentScoreRow["homework"] & { on_time_pct: number | null };
  exams: { id: string; kind: "ONLINE" | "PAPER"; name: string; date: string; subject: { id: string; name: string } | null; marks: number | null; total: number; percent: number | null; is_absent: boolean }[];
  homework_items: { id: string; title: string; subject: { id: string; name: string } | null; due_date: string; percent: number; is_missing: boolean; is_late: boolean }[];
  trend: { term: { id: string; name: string }; score_pct: number | null }[];
  strengths: SubjectScoreLine[];
  weaknesses: SubjectScoreLine[];
  published_only: boolean;
}
