/** One band of a grading scale (FND-11): an inclusive percentage range and its grade. */
interface GradeBand {
  min_pct: number;
  max_pct: number;
  grade: string;
  gpa: number | null;
}

/** The grade the API returns beside a percentage on exam results. */
interface Grade {
  grade: string;
  gpa: number | null;
}

/** `GET /grading-scale`: the workspace's own bands, or the Bangladesh national default. */
interface GradingScale {
  name: string;
  is_custom: boolean;
  bands: GradeBand[];
  updated_at: string | null;
}
