import { FeatureKey } from 'src/subscriptions/constants/feature-catalog';
import type { PlanFeatures } from 'src/subscriptions/constants/feature-catalog';

/**
 * Proctoring level per exam (P8-01, PRO-01, PRO-02). Pure rules, so they are tested on their own.
 *
 * - OFF: no checks, no camera.
 * - LIGHT: browser checks only (no camera or microphone).
 * - STRICT: browser checks plus camera, microphone and phone detection.
 *
 * A check runs when the exam's level includes it, the organisation's plan has it, and the teacher
 * did not switch it off. Auto-disqualification is off unless the teacher turns it on (and the plan
 * allows it); students are warned at 60% of the threshold.
 */
export enum ProctoringLevelEnum {
  OFF = 'OFF',
  LIGHT = 'LIGHT',
  STRICT = 'STRICT',
}

/** Checks in the student's browser, no camera. */
export const BROWSER_CHECKS = [
  FeatureKey.PROCTORING_TAB_SWITCH,
  FeatureKey.PROCTORING_FULLSCREEN_EXIT,
  FeatureKey.PROCTORING_PAGE_REFRESH,
  FeatureKey.PROCTORING_BROWSER_CHANGE,
  FeatureKey.PROCTORING_COPY_PASTE,
  FeatureKey.PROCTORING_IDLE,
  FeatureKey.PROCTORING_DEVTOOLS,
  FeatureKey.PROCTORING_DOUBLE_DISPLAY,
] as const;

/** Checks that need the camera or microphone. */
export const CAMERA_CHECKS = [
  FeatureKey.PROCTORING_NO_FACE,
  FeatureKey.PROCTORING_MULTIPLE_FACE,
  FeatureKey.PROCTORING_LOOKING_AWAY,
  FeatureKey.PROCTORING_PHONE,
  FeatureKey.PROCTORING_VOICE,
] as const;

export type ProctoringCheck = (typeof BROWSER_CHECKS)[number] | (typeof CAMERA_CHECKS)[number];
export const ALL_CHECKS: ProctoringCheck[] = [...BROWSER_CHECKS, ...CAMERA_CHECKS];

const LEVEL_CHECKS: Record<ProctoringLevelEnum, ProctoringCheck[]> = {
  [ProctoringLevelEnum.OFF]: [],
  [ProctoringLevelEnum.LIGHT]: [...BROWSER_CHECKS],
  [ProctoringLevelEnum.STRICT]: [...BROWSER_CHECKS, ...CAMERA_CHECKS],
};

/** Every proctoring check and auto-disqualification: exams from before organisations had them all. */
export const ALL_PROCTORING_FEATURES: PlanFeatures = Object.fromEntries([...ALL_CHECKS, FeatureKey.PROCTORING_AUTO_DISQUALIFICATION].map((key) => [key, true]));

/** The default threshold, as before P8 (15 flags). */
export const DEFAULT_DISQUALIFY_THRESHOLD = 15;
/** Students are warned when they reach this share of the threshold (PRO-02). */
export const WARNING_SHARE = 0.6;

export interface ExamProctoringSettings {
  proctoring_level: ProctoringLevelEnum;
  proctoring_checks_off: string[];
  auto_disqualify: boolean;
  disqualify_threshold: number;
  /** Checks whose flags count towards the threshold; null = every active check. */
  disqualify_checks: string[] | null;
}

/** What the student's browser runs for one exam. */
export interface EffectiveProctoring {
  level: ProctoringLevelEnum;
  checks: ProctoringCheck[];
  /** Whether the camera and microphone are needed. */
  camera: boolean;
  auto_disqualify: { threshold: number; warn_at: number; checks: ProctoringCheck[] } | null;
}

/** What a teacher may choose on this plan (PRO-01: "the levels offered are limited by the plan"). */
export interface ProctoringOptions {
  levels: { level: ProctoringLevelEnum; available: boolean; checks: ProctoringCheck[] }[];
  auto_disqualify_available: boolean;
  default_level: ProctoringLevelEnum;
}

const inPlan = (features: PlanFeatures, check: ProctoringCheck) => Boolean(features[check]);

export function proctoringOptions(features: PlanFeatures): ProctoringOptions {
  const levels = (Object.values(ProctoringLevelEnum) as ProctoringLevelEnum[]).map((level) => {
    const checks = LEVEL_CHECKS[level].filter((check) => inPlan(features, check));
    // A level is offered when the plan has at least one of what makes it that level.
    const available =
      level === ProctoringLevelEnum.OFF ||
      (level === ProctoringLevelEnum.LIGHT && BROWSER_CHECKS.some((c) => inPlan(features, c))) ||
      (level === ProctoringLevelEnum.STRICT && CAMERA_CHECKS.some((c) => inPlan(features, c)));
    return { level, available, checks };
  });
  const best = [...levels].reverse().find((l) => l.available)!.level;
  return { levels, auto_disqualify_available: Boolean(features[FeatureKey.PROCTORING_AUTO_DISQUALIFICATION]), default_level: best };
}

/** Why settings are refused, or null when they fit the plan. */
export function settingsProblem(features: PlanFeatures, settings: ExamProctoringSettings): 'LEVEL_NOT_IN_PLAN' | 'AUTO_DISQUALIFY_NOT_IN_PLAN' | 'CHECKS_INVALID' | null {
  const options = proctoringOptions(features);
  if (!options.levels.find((l) => l.level === settings.proctoring_level)?.available) return 'LEVEL_NOT_IN_PLAN';
  if (settings.auto_disqualify && !options.auto_disqualify_available) return 'AUTO_DISQUALIFY_NOT_IN_PLAN';
  const known = new Set<string>(ALL_CHECKS);
  if (settings.proctoring_checks_off.some((c) => !known.has(c)) || (settings.disqualify_checks ?? []).some((c) => !known.has(c))) return 'CHECKS_INVALID';
  if (settings.auto_disqualify && effectiveProctoring(features, settings).auto_disqualify?.checks.length === 0) return 'CHECKS_INVALID';
  return null;
}

/**
 * The checks the student runs: the level's checks that the plan has, minus those switched off.
 * Auto-disqualification counts the chosen checks among those (all of them when none are chosen).
 */
export function effectiveProctoring(features: PlanFeatures, settings: ExamProctoringSettings): EffectiveProctoring {
  const off = new Set(settings.proctoring_checks_off);
  const checks = LEVEL_CHECKS[settings.proctoring_level].filter((check) => inPlan(features, check) && !off.has(check));
  const counted = settings.disqualify_checks ? checks.filter((check) => settings.disqualify_checks!.includes(check)) : checks;
  const autoDisqualify = settings.auto_disqualify && Boolean(features[FeatureKey.PROCTORING_AUTO_DISQUALIFICATION]) && checks.length > 0;
  return {
    level: settings.proctoring_level,
    checks,
    camera: checks.some((check) => (CAMERA_CHECKS as readonly string[]).includes(check)),
    auto_disqualify: autoDisqualify
      ? { threshold: settings.disqualify_threshold, warn_at: Math.max(1, Math.ceil(settings.disqualify_threshold * WARNING_SHARE)), checks: counted }
      : null,
  };
}
