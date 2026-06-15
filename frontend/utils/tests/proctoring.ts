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
};

export const getProctoringRiskLevel = (points: number): ProctoringRiskLevel => {
  if (points >= 10) {
    return "Likely Cheating";
  }

  if (points >= 6) {
    return "High Risk";
  }

  if (points >= 3) {
    return "Suspicious";
  }

  return "Normal";
};

export const createProctoringSummary = (state: ProctoringState): ProctoringSummary => ({
  flags: state.flags,
  totalPenaltyPoints: state.totalPenaltyPoints,
  riskLevel: state.riskLevel,
  isDisqualified: state.isDisqualified,
});
