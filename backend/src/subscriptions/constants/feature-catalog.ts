export enum FeatureGroup {
  QUESTION = 'Question',
  BRANDING = 'Branding',
  ANALYTICS = 'Analytics',
  NOTIFICATIONS = 'Notifications',
  PROCTORING = 'Proctoring',
}

export enum LimitKey {
  MAX_EXAMS_PER_MONTH = 'max_exams_per_month',
  MAX_TOTAL_EXAMS = 'max_total_exams',
  MAX_STUDENTS_PER_EXAM = 'max_students_per_exam',
  MAX_QUESTION_BANK_SIZE = 'max_question_bank_size',
  MAX_STORAGE_MB = 'max_storage_mb',
}

export enum FeatureKey {
  ALLOW_GRADED_QUESTIONS = 'allow_graded_questions',
  ALLOW_UNGRADED_QUESTIONS = 'allow_ungraded_questions',
  ALLOW_PASSAGE_QUESTIONS = 'allow_passage_questions',
  ALLOW_QUESTION_IMAGES = 'allow_question_images',
  ALLOW_QUESTION_IMPORT_EXPORT = 'allow_question_import_export',
  ENABLE_REPORT_WATERMARK = 'enable_report_watermark',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  STUDENT_RISK_SCORE = 'student_risk_score',
  GRAPHICAL_ANALYTICS = 'graphical_analytics',
  PERFORMANCE_GRAPHS = 'performance_graphs',
  PUSH_NOTIFICATIONS = 'push_notifications',
  SUSPICIOUS_ACTIVITY_NOTIFICATIONS = 'suspicious_activity_notifications',
  PROCTORING_TAB_SWITCH = 'proctoring_tab_switch',
  PROCTORING_FULLSCREEN_EXIT = 'proctoring_fullscreen_exit',
  PROCTORING_PAGE_REFRESH = 'proctoring_page_refresh',
  PROCTORING_COPY_PASTE = 'proctoring_copy_paste',
  PROCTORING_IDLE = 'proctoring_idle',
  PROCTORING_BROWSER_CHANGE = 'proctoring_browser_change',
  PROCTORING_NO_FACE = 'proctoring_no_face',
  PROCTORING_MULTIPLE_FACE = 'proctoring_multiple_face',
  PROCTORING_LOOKING_AWAY = 'proctoring_looking_away',
  PROCTORING_DEVTOOLS = 'proctoring_devtools',
  PROCTORING_DOUBLE_DISPLAY = 'proctoring_double_display',
  PROCTORING_PHONE = 'proctoring_phone',
  PROCTORING_VOICE = 'proctoring_voice',
  PROCTORING_VIDEO_MONITORING = 'proctoring_video_monitoring',
  PROCTORING_REAL_TIME_ALERTS = 'proctoring_real_time_alerts',
  PROCTORING_AUTO_DISQUALIFICATION = 'proctoring_auto_disqualification',
}

export type PlanFeatures = Partial<Record<FeatureKey, boolean>>;
export type PlanLimits = Partial<Record<LimitKey, number>>;

export interface CatalogFeatureDefinition {
  key: FeatureKey;
  group: FeatureGroup;
  label: string;
  description?: string;
  /** Maps to frontend proctoring hook when applicable */
  proctoringHook?: string;
}

export interface CatalogLimitDefinition {
  key: LimitKey;
  label: string;
  description?: string;
  min?: number;
}

export const FEATURE_CATALOG: CatalogFeatureDefinition[] = [
  { key: FeatureKey.ALLOW_GRADED_QUESTIONS, group: FeatureGroup.QUESTION, label: 'Graded questions' },
  { key: FeatureKey.ALLOW_UNGRADED_QUESTIONS, group: FeatureGroup.QUESTION, label: 'Ungraded questions' },
  { key: FeatureKey.ALLOW_PASSAGE_QUESTIONS, group: FeatureGroup.QUESTION, label: 'Passage questions' },
  { key: FeatureKey.ALLOW_QUESTION_IMAGES, group: FeatureGroup.QUESTION, label: 'Question images' },
  { key: FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT, group: FeatureGroup.QUESTION, label: 'Import / export questions' },
  { key: FeatureKey.ENABLE_REPORT_WATERMARK, group: FeatureGroup.BRANDING, label: 'Report watermark' },
  { key: FeatureKey.GRAPHICAL_ANALYTICS, group: FeatureGroup.ANALYTICS, label: 'Graphical analytics' },
  { key: FeatureKey.PERFORMANCE_GRAPHS, group: FeatureGroup.ANALYTICS, label: 'Performance graphs' },
  { key: FeatureKey.ADVANCED_ANALYTICS, group: FeatureGroup.ANALYTICS, label: 'Advanced analytics' },
  { key: FeatureKey.STUDENT_RISK_SCORE, group: FeatureGroup.ANALYTICS, label: 'Student risk score' },
  { key: FeatureKey.PUSH_NOTIFICATIONS, group: FeatureGroup.NOTIFICATIONS, label: 'Push notifications' },
  {
    key: FeatureKey.SUSPICIOUS_ACTIVITY_NOTIFICATIONS,
    group: FeatureGroup.NOTIFICATIONS,
    label: 'Suspicious activity notifications',
  },
  {
    key: FeatureKey.PROCTORING_TAB_SWITCH,
    group: FeatureGroup.PROCTORING,
    label: 'Tab switch detection',
    proctoringHook: 'useTabSwitchDetection',
  },
  {
    key: FeatureKey.PROCTORING_FULLSCREEN_EXIT,
    group: FeatureGroup.PROCTORING,
    label: 'Fullscreen exit detection',
    proctoringHook: 'useFullscreenExitDetection',
  },
  {
    key: FeatureKey.PROCTORING_PAGE_REFRESH,
    group: FeatureGroup.PROCTORING,
    label: 'Page refresh detection',
    proctoringHook: 'usePageRefreshDetection',
  },
  {
    key: FeatureKey.PROCTORING_COPY_PASTE,
    group: FeatureGroup.PROCTORING,
    label: 'Copy/paste detection',
    proctoringHook: 'useCopyPasteDetection',
  },
  {
    key: FeatureKey.PROCTORING_IDLE,
    group: FeatureGroup.PROCTORING,
    label: 'Idle detection',
    proctoringHook: 'useIdleDetection',
  },
  {
    key: FeatureKey.PROCTORING_BROWSER_CHANGE,
    group: FeatureGroup.PROCTORING,
    label: 'Browser change detection',
    proctoringHook: 'useBrowserChangeDetection',
  },
  {
    key: FeatureKey.PROCTORING_NO_FACE,
    group: FeatureGroup.PROCTORING,
    label: 'No face detection',
    proctoringHook: 'useNoFaceDetection',
  },
  {
    key: FeatureKey.PROCTORING_MULTIPLE_FACE,
    group: FeatureGroup.PROCTORING,
    label: 'Multiple face detection',
    proctoringHook: 'useMultipleFaceDetection',
  },
  {
    key: FeatureKey.PROCTORING_LOOKING_AWAY,
    group: FeatureGroup.PROCTORING,
    label: 'Looking away detection',
    proctoringHook: 'useLookingAwayDetection',
  },
  {
    key: FeatureKey.PROCTORING_DEVTOOLS,
    group: FeatureGroup.PROCTORING,
    label: 'DevTools detection',
    proctoringHook: 'useDevToolsDetection',
  },
  {
    key: FeatureKey.PROCTORING_DOUBLE_DISPLAY,
    group: FeatureGroup.PROCTORING,
    label: 'Double display detection',
    proctoringHook: 'useDoubleDisplayDetection',
  },
  {
    key: FeatureKey.PROCTORING_PHONE,
    group: FeatureGroup.PROCTORING,
    label: 'Phone detection',
    proctoringHook: 'usePhoneDetection',
  },
  {
    key: FeatureKey.PROCTORING_VOICE,
    group: FeatureGroup.PROCTORING,
    label: 'Voice detection',
    proctoringHook: 'useVoiceDetection',
  },
  {
    key: FeatureKey.PROCTORING_VIDEO_MONITORING,
    group: FeatureGroup.PROCTORING,
    label: 'Video monitoring',
    proctoringHook: 'useVideoMonitoring',
  },
  {
    key: FeatureKey.PROCTORING_REAL_TIME_ALERTS,
    group: FeatureGroup.PROCTORING,
    label: 'Real-time alerts',
    proctoringHook: 'useRealTimeAlerts',
  },
  {
    key: FeatureKey.PROCTORING_AUTO_DISQUALIFICATION,
    group: FeatureGroup.PROCTORING,
    label: 'Auto-disqualification',
    proctoringHook: 'autoDisqualify',
  },
];

export const LIMIT_CATALOG: CatalogLimitDefinition[] = [
  { key: LimitKey.MAX_EXAMS_PER_MONTH, label: 'Max exams per month', min: 0 },
  { key: LimitKey.MAX_TOTAL_EXAMS, label: 'Max total exams (lifetime)', min: 0 },
  { key: LimitKey.MAX_STUDENTS_PER_EXAM, label: 'Max students per exam', min: 1 },
  { key: LimitKey.MAX_QUESTION_BANK_SIZE, label: 'Max question bank size', min: 0 },
  { key: LimitKey.MAX_STORAGE_MB, label: 'Max storage (MB)', min: 0 },
];

export const ALL_FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);
export const ALL_LIMIT_KEYS = LIMIT_CATALOG.map((l) => l.key);

export function defaultFeatures(): PlanFeatures {
  return ALL_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as PlanFeatures);
}

export function defaultLimits(): PlanLimits {
  return ALL_LIMIT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as PlanLimits);
}

export function mergeFeatures(base: PlanFeatures, overrides?: PlanFeatures | null): PlanFeatures {
  const merged = { ...defaultFeatures(), ...base };
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        merged[key as FeatureKey] = Boolean(value);
      }
    });
  }
  return merged;
}

export function mergeLimits(base: PlanLimits, overrides?: PlanLimits | null): PlanLimits {
  const merged = { ...defaultLimits(), ...base };
  if (overrides) {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        merged[key as LimitKey] = Number(value);
      }
    });
  }
  return merged;
}

export function validateFeaturesInput(features: Record<string, unknown>): PlanFeatures {
  const result: PlanFeatures = {};
  for (const key of ALL_FEATURE_KEYS) {
    if (features[key] !== undefined) {
      result[key] = Boolean(features[key]);
    }
  }
  return result;
}

export function validateLimitsInput(limits: Record<string, unknown>): PlanLimits {
  const result: PlanLimits = {};
  for (const key of ALL_LIMIT_KEYS) {
    if (limits[key] !== undefined) {
      const num = Number(limits[key]);
      if (!Number.isNaN(num) && num >= 0) {
        result[key] = num;
      }
    }
  }
  return result;
}

/** Seed presets — business logic uses keys, not plan slugs */
export const SEED_PLAN_PRESETS = {
  free: {
    slug: 'free',
    name: 'Free',
    description: 'Basic access with limited features',
    price_monthly: 0,
    price_half_yearly: 0,
    price_yearly: 0,
    sort_order: 1,
    features: {
      [FeatureKey.ALLOW_GRADED_QUESTIONS]: true,
      [FeatureKey.ENABLE_REPORT_WATERMARK]: true,
      [FeatureKey.PROCTORING_TAB_SWITCH]: true,
      [FeatureKey.PROCTORING_FULLSCREEN_EXIT]: true,
      [FeatureKey.PROCTORING_PAGE_REFRESH]: true,
    },
    limits: {
      [LimitKey.MAX_TOTAL_EXAMS]: 2,
      [LimitKey.MAX_STUDENTS_PER_EXAM]: 15,
    },
  },
  basic: {
    slug: 'basic',
    name: 'Basic',
    description: 'For individual teachers getting started',
    price_monthly: 100,
    price_half_yearly: 500,
    price_yearly: 1000,
    sort_order: 2,
    features: {
      [FeatureKey.ALLOW_GRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_UNGRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT]: true,
      [FeatureKey.ENABLE_REPORT_WATERMARK]: true,
      [FeatureKey.PROCTORING_TAB_SWITCH]: true,
      [FeatureKey.PROCTORING_FULLSCREEN_EXIT]: true,
      [FeatureKey.PROCTORING_PAGE_REFRESH]: true,
      [FeatureKey.PROCTORING_COPY_PASTE]: true,
      [FeatureKey.PROCTORING_IDLE]: true,
      [FeatureKey.PROCTORING_BROWSER_CHANGE]: true,
    },
    limits: {
      [LimitKey.MAX_EXAMS_PER_MONTH]: 5,
      [LimitKey.MAX_STUDENTS_PER_EXAM]: 30,
    },
  },
  premium: {
    slug: 'premium',
    name: 'Premium',
    description: 'Most popular — full features for serious educators',
    price_monthly: 300,
    price_half_yearly: 1650,
    price_yearly: 3000,
    sort_order: 3,
    features: {
      [FeatureKey.ALLOW_GRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_UNGRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT]: true,
      [FeatureKey.ALLOW_QUESTION_IMAGES]: true,
      [FeatureKey.PROCTORING_TAB_SWITCH]: true,
      [FeatureKey.PROCTORING_FULLSCREEN_EXIT]: true,
      [FeatureKey.PROCTORING_PAGE_REFRESH]: true,
      [FeatureKey.PROCTORING_COPY_PASTE]: true,
      [FeatureKey.PROCTORING_IDLE]: true,
      [FeatureKey.PROCTORING_BROWSER_CHANGE]: true,
      [FeatureKey.PROCTORING_NO_FACE]: true,
      [FeatureKey.PROCTORING_MULTIPLE_FACE]: true,
      [FeatureKey.PROCTORING_LOOKING_AWAY]: true,
      [FeatureKey.PROCTORING_DEVTOOLS]: true,
      [FeatureKey.PROCTORING_DOUBLE_DISPLAY]: true,
      [FeatureKey.GRAPHICAL_ANALYTICS]: true,
      [FeatureKey.PERFORMANCE_GRAPHS]: true,
    },
    limits: {
      [LimitKey.MAX_EXAMS_PER_MONTH]: 5,
      [LimitKey.MAX_STUDENTS_PER_EXAM]: 80,
    },
  },
  pro: {
    slug: 'pro',
    name: 'Pro',
    description: 'Enterprise-grade features for institutions',
    price_monthly: 500,
    price_half_yearly: 2800,
    price_yearly: 5000,
    sort_order: 4,
    features: {
      [FeatureKey.ALLOW_GRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_UNGRADED_QUESTIONS]: true,
      [FeatureKey.ALLOW_PASSAGE_QUESTIONS]: true,
      [FeatureKey.ALLOW_QUESTION_IMAGES]: true,
      [FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT]: true,
      [FeatureKey.PROCTORING_TAB_SWITCH]: true,
      [FeatureKey.PROCTORING_FULLSCREEN_EXIT]: true,
      [FeatureKey.PROCTORING_PAGE_REFRESH]: true,
      [FeatureKey.PROCTORING_COPY_PASTE]: true,
      [FeatureKey.PROCTORING_IDLE]: true,
      [FeatureKey.PROCTORING_BROWSER_CHANGE]: true,
      [FeatureKey.PROCTORING_NO_FACE]: true,
      [FeatureKey.PROCTORING_MULTIPLE_FACE]: true,
      [FeatureKey.PROCTORING_LOOKING_AWAY]: true,
      [FeatureKey.PROCTORING_DEVTOOLS]: true,
      [FeatureKey.PROCTORING_DOUBLE_DISPLAY]: true,
      [FeatureKey.PROCTORING_PHONE]: true,
      [FeatureKey.PROCTORING_VOICE]: true,
      [FeatureKey.PROCTORING_VIDEO_MONITORING]: true,
      [FeatureKey.PROCTORING_REAL_TIME_ALERTS]: true,
      [FeatureKey.PROCTORING_AUTO_DISQUALIFICATION]: true,
      [FeatureKey.ADVANCED_ANALYTICS]: true,
      [FeatureKey.STUDENT_RISK_SCORE]: true,
      [FeatureKey.GRAPHICAL_ANALYTICS]: true,
      [FeatureKey.PERFORMANCE_GRAPHS]: true,
      [FeatureKey.PUSH_NOTIFICATIONS]: true,
      [FeatureKey.SUSPICIOUS_ACTIVITY_NOTIFICATIONS]: true,
    },
    limits: {
      [LimitKey.MAX_EXAMS_PER_MONTH]: 50,
      [LimitKey.MAX_STUDENTS_PER_EXAM]: 200,
    },
  },
} as const;
