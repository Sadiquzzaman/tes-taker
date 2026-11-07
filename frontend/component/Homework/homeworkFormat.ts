/** Shared helpers for the homework screens. */

/** How close the due time is, for the student list and the detail page. */
export type DueState = "none" | "overdue" | "soon" | "later";

const DAY_MS = 24 * 60 * 60_000;

export const dueState = (dueAt: string | null, now = Date.now()): DueState => {
  if (!dueAt) return "none";
  const due = new Date(dueAt).getTime();
  if (due < now) return "overdue";
  return due - now <= DAY_MS ? "soon" : "later";
};

export const DUE_TONE: Record<DueState, "neutral" | "danger" | "warning" | "success"> = {
  none: "neutral",
  overdue: "danger",
  soon: "warning",
  later: "success",
};

export const STATUS_TONE: Record<HomeworkStatus, "neutral" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SCHEDULED: "warning",
  PUBLISHED: "success",
  CANCELLED: "danger",
};

/** "Class 6 A, Class 6 B" */
export const classesLabel = (homework: Pick<HomeworkItem, "targets">) => homework.targets.map((target) => target.section_label).join(", ");

/** The rating kinds a teacher can give, in order (HW-05). */
export const RATING_KEYS = ["neatness", "effort", "on_time"] as const;

type NumberFormat = (value: number, options?: Intl.NumberFormatOptions) => string;

/** "8/10 · 80% (A+)", or null when there is no score yet. */
export const scoreLabel = (score: Pick<HomeworkScore, "final_score" | "total_marks" | "percent" | "grade">, number: NumberFormat): string | null => {
  if (score.final_score === null) return null;
  const marks = score.total_marks === null ? number(score.final_score) : `${number(score.final_score)}/${number(score.total_marks)}`;
  const percent = score.percent === null ? "" : ` · ${number(score.percent, { maximumFractionDigits: 1 })}%`;
  const grade = score.grade ? ` (${score.grade.grade})` : "";
  return `${marks}${percent}${grade}`;
};
