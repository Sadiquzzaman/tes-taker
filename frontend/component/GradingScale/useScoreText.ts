"use client";

import { useCallback } from "react";
import useFormat from "@/i18n/useFormat";
import { toNumber } from "@/utils/gradingScale";

export interface ScoreParts {
  score: number | string | null | undefined;
  max: number | string | null | undefined;
  /** As the API sends it (0–100); worked out from the marks when missing. */
  percentage?: number | string | null;
  grade?: Grade | null;
}

/**
 * Marks with percentage and grade, the same everywhere (FND-11): "64/80 · 80% (A+)", with the
 * reader's digits (৬৪/৮০ · ৮০% (A+) in Bangla). "—" when there are no marks yet. Only numbers and
 * the grade change between languages, so no message is needed.
 */
const useScoreText = () => {
  const format = useFormat();

  return useCallback(
    ({ score, max, percentage, grade }: ScoreParts): string => {
      const marks = toNumber(score);
      const total = toNumber(max);
      if (marks === null || total === null) return "—";
      const text = `${format.number(marks)}/${format.number(total)}`;
      const pct = toNumber(percentage) ?? (total > 0 ? (marks / total) * 100 : null);
      if (pct === null) return text;
      const percent = format.number(pct / 100, { style: "percent", maximumFractionDigits: 2 });
      return grade ? `${text} · ${percent} (${grade.grade})` : `${text} · ${percent}`;
    },
    [format],
  );
};

export default useScoreText;
