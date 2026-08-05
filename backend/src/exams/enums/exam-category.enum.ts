/**
 * Product-line categories for exams. Extensible for TOEFL, GRE, SAT, PTE, etc.
 * Orthogonal to exam_kind / is_model_test (layout) and question categories.
 */
export enum ExamCategoryEnum {
  ACADEMIC = 'academic',
  IELTS = 'ielts',
}

/**
 * Stable module keys. Prefer namespaced keys so future categories
 * (e.g. toefl.reading) do not collide.
 */
export enum IeltsModuleKey {
  READING = 'ielts.reading',
  WRITING = 'ielts.writing',
  LISTENING = 'ielts.listening',
  SPEAKING = 'ielts.speaking',
}

export type ExamModuleDefinition = {
  category: ExamCategoryEnum;
  key: string;
  label: string;
  description?: string;
  /** Default scoring mode for the module */
  scoring: 'auto' | 'manual' | 'mixed';
};

/** Catalog of modules per category — add TOEFL/GRE entries here later. */
export const EXAM_MODULE_CATALOG: ExamModuleDefinition[] = [
  {
    category: ExamCategoryEnum.IELTS,
    key: IeltsModuleKey.READING,
    label: 'Reading',
    description: 'Passages with auto-scored question groups',
    scoring: 'auto',
  },
  {
    category: ExamCategoryEnum.IELTS,
    key: IeltsModuleKey.WRITING,
    label: 'Writing',
    description: 'Task 1 / Task 2 essays (manual grading)',
    scoring: 'manual',
  },
  {
    category: ExamCategoryEnum.IELTS,
    key: IeltsModuleKey.LISTENING,
    label: 'Listening',
    description: 'Audio-linked question groups (auto-scored)',
    scoring: 'auto',
  },
  {
    category: ExamCategoryEnum.IELTS,
    key: IeltsModuleKey.SPEAKING,
    label: 'Speaking',
    description: 'Part 1–3 with recorded answers (manual grading)',
    scoring: 'manual',
  },
];

export function getModulesForCategory(category: ExamCategoryEnum): ExamModuleDefinition[] {
  return EXAM_MODULE_CATALOG.filter((module) => module.category === category);
}

export function isValidModuleKeyForCategory(category: ExamCategoryEnum, moduleKey: string): boolean {
  return getModulesForCategory(category).some((module) => module.key === moduleKey);
}

export function getModuleLabel(moduleKey: string): string {
  return EXAM_MODULE_CATALOG.find((module) => module.key === moduleKey)?.label ?? moduleKey;
}
