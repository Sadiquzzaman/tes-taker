/** Top-level question category from the test builder UI */
export enum QuestionCategoryEnum {
  GRADED = 'graded',
  UNGRADED = 'ungraded',
  PASSAGE = 'passage-question',
}

/** Auto-scored subtypes (graded + passage children) */
export const AUTO_SCORED_SUB_TYPES = [
  'multiple-choice',
  'multiple-response',
  'true-false',
  'fill-in-the-blanks',
  'matching-ordering',
] as const;

export type AutoScoredSubType = (typeof AUTO_SCORED_SUB_TYPES)[number];

/** Manual-scoring subtypes (ungraded) */
export const MANUAL_SUB_TYPES = ['true-false', 'essay', 'fill-in-the-gaps'] as const;

export type ManualSubType = (typeof MANUAL_SUB_TYPES)[number];

/**
 * Subtypes allowed as Passage / CQ children.
 * Includes all auto-scored types plus Essay so Creative Questions can be built
 * from a shared passage stimulus without a dedicated CQ entity.
 */
export const PASSAGE_CHILD_SUB_TYPES = [
  ...AUTO_SCORED_SUB_TYPES,
  'essay',
] as const;

export type PassageChildSubType = (typeof PASSAGE_CHILD_SUB_TYPES)[number];

export type QuestionSubType = AutoScoredSubType | ManualSubType;

export enum AnswerValueTypeEnum {
  OPTION_ID = 'optionId',
  MATCHING_ORDERING = 'matchingOrdering',
  TEXT = 'text',
}
