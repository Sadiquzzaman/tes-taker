import { PlanFeatures, SEED_PLAN_PRESETS } from 'src/subscriptions/constants/feature-catalog';
import { effectiveProctoring, ExamProctoringSettings, proctoringOptions, ProctoringLevelEnum, settingsProblem } from './proctoring-settings';

const plan = (slug: keyof typeof SEED_PLAN_PRESETS) => SEED_PLAN_PRESETS[slug].features as PlanFeatures;
const settings = (extra: Partial<ExamProctoringSettings> = {}): ExamProctoringSettings => ({
  proctoring_level: ProctoringLevelEnum.STRICT,
  proctoring_checks_off: [],
  auto_disqualify: false,
  disqualify_threshold: 15,
  disqualify_checks: null,
  alert_flags: null,
  ...extra,
});

describe('proctoring level per exam (PRO-01, PRO-02)', () => {
  it('offers the levels the plan allows: Free and Basic up to Light, Premium and Pro Strict', () => {
    const levels = (slug: keyof typeof SEED_PLAN_PRESETS) => proctoringOptions(plan(slug)).levels.filter((l) => l.available).map((l) => l.level);
    expect(levels('free')).toEqual(['OFF', 'LIGHT']);
    expect(levels('basic')).toEqual(['OFF', 'LIGHT']);
    expect(levels('premium')).toEqual(['OFF', 'LIGHT', 'STRICT']);
    expect(proctoringOptions(plan('pro'))).toMatchObject({ default_level: 'STRICT', auto_disqualify_available: true });
    expect(proctoringOptions(plan('premium')).auto_disqualify_available).toBe(false);
  });

  it('runs the level’s checks that the plan has, minus those switched off; the camera only when a camera check runs', () => {
    expect(effectiveProctoring(plan('pro'), settings({ proctoring_level: ProctoringLevelEnum.OFF }))).toEqual({ level: 'OFF', checks: [], camera: false, auto_disqualify: null });
    const light = effectiveProctoring(plan('basic'), settings({ proctoring_level: ProctoringLevelEnum.LIGHT, proctoring_checks_off: ['proctoring_idle'] }));
    expect(light.camera).toBe(false);
    expect(light.checks).toEqual(['proctoring_tab_switch', 'proctoring_fullscreen_exit', 'proctoring_page_refresh', 'proctoring_browser_change', 'proctoring_copy_paste']);
    const strict = effectiveProctoring(plan('premium'), settings());
    expect(strict.camera).toBe(true);
    expect(strict.checks).toContain('proctoring_no_face');
    // Premium has no phone or voice detection.
    expect(strict.checks).not.toContain('proctoring_phone');
    expect(effectiveProctoring(plan('pro'), settings({ proctoring_checks_off: ['proctoring_no_face', 'proctoring_multiple_face', 'proctoring_looking_away', 'proctoring_phone', 'proctoring_voice'] })).camera).toBe(false);
  });

  it('auto-disqualifies only when the teacher turns it on, counting the chosen checks, with a warning at 60%', () => {
    expect(effectiveProctoring(plan('pro'), settings()).auto_disqualify).toBeNull();
    expect(effectiveProctoring(plan('pro'), settings({ auto_disqualify: true, disqualify_threshold: 5, disqualify_checks: ['proctoring_phone', 'proctoring_multiple_face'] })).auto_disqualify).toEqual({
      threshold: 5,
      warn_at: 3,
      checks: ['proctoring_multiple_face', 'proctoring_phone'],
    });
    // Not on the plan: never, even if set.
    expect(effectiveProctoring(plan('premium'), settings({ auto_disqualify: true })).auto_disqualify).toBeNull();
  });

  it('refuses settings the plan does not allow, and unknown checks', () => {
    expect(settingsProblem(plan('basic'), settings())).toBe('LEVEL_NOT_IN_PLAN');
    expect(settingsProblem(plan('premium'), settings({ auto_disqualify: true }))).toBe('AUTO_DISQUALIFY_NOT_IN_PLAN');
    expect(settingsProblem(plan('pro'), settings({ proctoring_checks_off: ['nonsense'] }))).toBe('CHECKS_INVALID');
    expect(settingsProblem(plan('pro'), settings({ auto_disqualify: true, disqualify_checks: ['proctoring_voice'], proctoring_checks_off: ['proctoring_voice'] }))).toBe('CHECKS_INVALID');
    expect(settingsProblem(plan('free'), settings({ proctoring_level: ProctoringLevelEnum.LIGHT }))).toBeNull();
    expect(settingsProblem(plan('premium'), settings({ alert_flags: 5 }))).toBe('ALERTS_NOT_IN_PLAN');
    expect(settingsProblem(plan('pro'), settings({ alert_flags: 5 }))).toBeNull();
  });
});
