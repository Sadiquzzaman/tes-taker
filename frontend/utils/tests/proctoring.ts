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

export const PROCTORING_FLAG_COLOR_STYLES: Record<
  ProctoringFlagColorTier,
  { background: string; text: string; border: string }
> = {
  green: {
    background: "#49734F",
    text: "#FFFFFF",
    border: "#49734F",
  },
  "light-green": {
    background: "#8BC34A",
    text: "#1F2A21",
    border: "#8BC34A",
  },
  orange: {
    background: "#F79009",
    text: "#FFFFFF",
    border: "#F79009",
  },
  red: {
    background: "#D92D20",
    text: "#FFFFFF",
    border: "#D92D20",
  },
};

export const getProctoringFlagColorStyles = (flagCount: number) =>
  PROCTORING_FLAG_COLOR_STYLES[getProctoringFlagColorTier(flagCount)];

export const createProctoringSummary = (state: ProctoringState): ProctoringSummary => ({
  flags: state.flags,
  totalPenaltyPoints: state.totalPenaltyPoints,
  flagCount: state.flags.length,
  riskLevel: state.riskLevel,
  isDisqualified: state.isDisqualified,
});

export const EXAM_RULES: readonly string[] = [
  "Stay camera and mic on.",
  "Read the test paper/instructions carefully.",
  "Do not open additional tabs.",
  "Finish the test within the allotted time.",
  "Proctor can flag your activity.",
  `If you receive ${PROCTORING_CONFIG.disqualifyAfter} flags, the test will be terminated.`,
];

export const DISQUALIFICATION_MESSAGE =
  "You have been disqualified from the examination because the maximum allowed violations have been exceeded.";
