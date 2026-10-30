/**
 * What an organisation calls its two academic levels (FND-03; design §9.1 `organizations.level_labels`):
 * "Class / Section" for schools, "Course / Batch" for coaching centres, or its own words.
 * Stored once per organisation in English (singular and plural) and Bangla; NULL = Class / Section.
 */
export enum LevelLabelPresetEnum {
  CLASS_SECTION = 'CLASS_SECTION',
  COURSE_BATCH = 'COURSE_BATCH',
  CUSTOM = 'CUSTOM',
}

export type LevelLocale = 'en' | 'bn';

export interface LevelName {
  en: { one: string; other: string };
  bn: string;
}

export interface LevelLabels {
  preset: LevelLabelPresetEnum;
  class: LevelName;
  section: LevelName;
}

export const LEVEL_LABEL_MAX_LENGTH = 30;

export const LEVEL_LABEL_PRESETS: Record<Exclude<LevelLabelPresetEnum, LevelLabelPresetEnum.CUSTOM>, LevelLabels> = {
  [LevelLabelPresetEnum.CLASS_SECTION]: {
    preset: LevelLabelPresetEnum.CLASS_SECTION,
    class: { en: { one: 'Class', other: 'Classes' }, bn: 'ক্লাস' },
    section: { en: { one: 'Section', other: 'Sections' }, bn: 'সেকশন' },
  },
  [LevelLabelPresetEnum.COURSE_BATCH]: {
    preset: LevelLabelPresetEnum.COURSE_BATCH,
    class: { en: { one: 'Course', other: 'Courses' }, bn: 'কোর্স' },
    section: { en: { one: 'Batch', other: 'Batches' }, bn: 'ব্যাচ' },
  },
};

export const DEFAULT_LEVEL_LABELS = LEVEL_LABEL_PRESETS[LevelLabelPresetEnum.CLASS_SECTION];

const cleanName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed && trimmed.length <= LEVEL_LABEL_MAX_LENGTH ? trimmed : null;
};

const cleanLevel = (value: unknown): LevelName | null => {
  const level = value as Partial<LevelName> | null | undefined;
  const one = cleanName(level?.en?.one);
  const other = cleanName(level?.en?.other);
  const bn = cleanName(level?.bn);
  return one && other && bn ? { en: { one, other }, bn } : null;
};

/**
 * The labels to store for a preset (custom names are trimmed). Returns null when a custom name is
 * missing or too long; presets ignore any names sent with them.
 */
export function buildLevelLabels(
  preset: LevelLabelPresetEnum,
  custom?: { class?: unknown; section?: unknown },
): LevelLabels | null {
  if (preset !== LevelLabelPresetEnum.CUSTOM) return LEVEL_LABEL_PRESETS[preset];
  const classLevel = cleanLevel(custom?.class);
  const sectionLevel = cleanLevel(custom?.section);
  return classLevel && sectionLevel ? { preset, class: classLevel, section: sectionLevel } : null;
}

/**
 * The labels an organisation uses: its stored names, or Class / Section when it has none (or the
 * stored value is unreadable). Presets always use today's preset words.
 */
export function resolveLevelLabels(stored: unknown): LevelLabels {
  const value = stored as Partial<LevelLabels> | null | undefined;
  if (!value || !Object.values(LevelLabelPresetEnum).includes(value.preset as LevelLabelPresetEnum)) {
    return DEFAULT_LEVEL_LABELS;
  }
  return buildLevelLabels(value.preset as LevelLabelPresetEnum, value) ?? DEFAULT_LEVEL_LABELS;
}

/**
 * One level's name in a language, for text the server writes (SMS and PDFs, P2-08):
 * levelLabel(org.level_labels, 'class', 'en', { plural: true }) -> "Courses".
 */
export function levelLabel(
  stored: unknown,
  level: 'class' | 'section',
  locale: LevelLocale,
  options: { plural?: boolean } = {},
): string {
  const name = resolveLevelLabels(stored)[level];
  if (locale === 'bn') return name.bn;
  return options.plural ? name.en.other : name.en.one;
}
