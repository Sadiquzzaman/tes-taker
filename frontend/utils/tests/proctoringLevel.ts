/**
 * The exam's proctoring as the student's browser applies it (P8-01, PRO-01, PRO-02): which checks
 * run, whether the camera is needed, and which flags count towards auto-disqualification.
 */

/** The check (plan feature key) each flag comes from. Screen-share flags belong to no check. */
export const FLAG_CHECK: Record<ProctoringFlagType, string | null> = {
  "tab-switch": "proctoring_tab_switch",
  "window-blur": "proctoring_browser_change",
  "fullscreen-exit": "proctoring_fullscreen_exit",
  "no-face": "proctoring_no_face",
  "multiple-faces": "proctoring_multiple_face",
  "looking-away": "proctoring_looking_away",
  "phone-detected": "proctoring_phone",
  "paste-attempt": "proctoring_copy_paste",
  "restricted-action": "proctoring_copy_paste",
  "voice-detected": "proctoring_voice",
  "idle-too-long": "proctoring_idle",
  "devtools-open": "proctoring_devtools",
  "screen-sharing": null,
  "camera-blocked": "proctoring_no_face",
  "screen-share-stopped": null,
  "double-display": "proctoring_double_display",
};

/** Every check the exam screen knows; those not running are switched off for `useProctoring`. */
const ALL_CHECKS = [
  "proctoring_tab_switch",
  "proctoring_fullscreen_exit",
  "proctoring_page_refresh",
  "proctoring_browser_change",
  "proctoring_copy_paste",
  "proctoring_idle",
  "proctoring_devtools",
  "proctoring_double_display",
  "proctoring_no_face",
  "proctoring_multiple_face",
  "proctoring_looking_away",
  "proctoring_phone",
  "proctoring_voice",
];

/** The feature switches `useProctoring` reads: on for the exam's checks, off for the rest. */
export const proctoringFeaturesOf = (proctoring: EffectiveProctoring): Record<string, boolean> => ({
  ...Object.fromEntries(ALL_CHECKS.map((check) => [check, proctoring.checks.includes(check)])),
  proctoring_video_monitoring: proctoring.camera,
  proctoring_auto_disqualification: Boolean(proctoring.auto_disqualify),
});

/** Whether a flag counts towards the exam's disqualification threshold. */
export const countsTowardsLimit = (type: ProctoringFlagType, counted: string[] | null): boolean => {
  if (!counted) return true;
  const check = FLAG_CHECK[type];
  return check !== null && counted.includes(check);
};
