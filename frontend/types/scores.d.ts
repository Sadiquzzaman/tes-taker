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
