import { PROCTORING_CONFIG } from "./proctoringConfig";

export const PROCTORING_FLAG_POINTS: Record<ProctoringFlagType, number> = {
  "tab-switch": 1,
  "window-blur": 1,
  "fullscreen-exit": 1,
  "no-face": 1,
  "multiple-faces": 3,
  "looking-away": 1,
  "phone-detected": 3,
  "paste-attempt": 2,
  "restricted-action": 1,
  "voice-detected": 2,
  "idle-too-long": 1,
  "devtools-open": 2,
  "screen-sharing": 10,
  "camera-blocked": 1,
  "screen-share-stopped": 1,
  "double-display": 1,
};

export const getProctoringFlagCount = (flags: ProctoringFlag[]) => flags.length;

export const getProctoringRiskLevel = (flagCount: number): ProctoringRiskLevel => {
  if (flagCount >= PROCTORING_CONFIG.redLimit) {
    return "Likely Cheating";
  }

  if (flagCount > PROCTORING_CONFIG.lightGreenLimit) {
    return "High Risk";
  }

  if (flagCount > PROCTORING_CONFIG.greenLimit) {
    return "Suspicious";
  }

  return "Normal";
};

export type ProctoringFlagColorTier = "green" | "light-green" | "orange" | "red";

export const getProctoringFlagColorTier = (flagCount: number): ProctoringFlagColorTier => {
  if (flagCount >= PROCTORING_CONFIG.redLimit) {
    return "red";
  }

  if (flagCount > PROCTORING_CONFIG.lightGreenLimit && flagCount <= PROCTORING_CONFIG.orangeLimit) {
    return "orange";
  }

  if (flagCount > PROCTORING_CONFIG.greenLimit) {
    return "light-green";
  }

  return "green";
};

/** Token classes for each flag-count level: calm green, then lighter, then amber, then red. */
export const PROCTORING_FLAG_TONE_CLASSES: Record<ProctoringFlagColorTier, string> = {
  green: "bg-primary text-ink-inverse border-primary",
  "light-green": "bg-success-soft text-success border-success",
  orange: "bg-warning text-ink-inverse border-warning",
  red: "bg-danger text-ink-inverse border-danger",
};

export const getProctoringFlagToneClasses = (flagCount: number) =>
  PROCTORING_FLAG_TONE_CLASSES[getProctoringFlagColorTier(flagCount)];

export const createProctoringSummary = (state: ProctoringState): ProctoringSummary => ({
  flags: state.flags,
  totalPenaltyPoints: state.totalPenaltyPoints,
  flagCount: state.flags.length,
  riskLevel: state.riskLevel,
  isDisqualified: state.isDisqualified,
});

/** The exam rules shown before a test, as keys under `exam.permissions.rules` in messages/*.json. */
export const EXAM_RULE_KEYS = ["media", "read", "tabs", "time", "flags", "limit"] as const;
