/** Top-level question category from the test builder UI */
export enum QuestionCategoryEnum {
  GRADED = 'graded',
  UNGRADED = 'ungraded',
  PASSAGE = 'passage-question',
  IELTS = 'ielts',
}

/** Auto-scored subtypes (graded + passage children + IELTS reading/listening) */
export const AUTO_SCORED_SUB_TYPES = [
  'multiple-choice',
  'multiple-response',
  'true-false',
  'true-false-not-given',
  'yes-no-not-given',
  'fill-in-the-blanks',
  'sentence-completion',
  'summary-completion',
  'table-completion',
  'diagram-label',
  'short-answer',
  'answer-box',
  'matching-ordering',
] as const;

export type AutoScoredSubType = (typeof AUTO_SCORED_SUB_TYPES)[number];

/** Manual-scoring subtypes (ungraded + IELTS writing/speaking) */
export const MANUAL_SUB_TYPES = [
  'true-false',
  'essay',
  'fill-in-the-gaps',
  'writing-task-1',
  'writing-task-2',
  'speaking-part-1',
  'speaking-part-2',
  'speaking-part-3',
] as const;

export type ManualSubType = (typeof MANUAL_SUB_TYPES)[number];

/**
 * Subtypes allowed as Passage / CQ / IELTS Reading passage children.
 */
export const PASSAGE_CHILD_SUB_TYPES = [
  ...AUTO_SCORED_SUB_TYPES,
  'essay',
] as const;

export type PassageChildSubType = (typeof PASSAGE_CHILD_SUB_TYPES)[number];

/** IELTS-specific subtypes offered under the IELTS builder tab */
export const IELTS_AUTO_SUB_TYPES = [
  'multiple-choice',
  'multiple-response',
  'true-false-not-given',
  'yes-no-not-given',
  'matching-ordering',
  'fill-in-the-blanks',
  'sentence-completion',
  'summary-completion',
  'table-completion',
  'diagram-label',
  'short-answer',
] as const;

export const IELTS_MANUAL_SUB_TYPES = [
  'writing-task-1',
  'writing-task-2',
  'speaking-part-1',
  'speaking-part-2',
  'speaking-part-3',
] as const;

export type QuestionSubType = AutoScoredSubType | ManualSubType;

export enum AnswerValueTypeEnum {
  OPTION_ID = 'optionId',
  MATCHING_ORDERING = 'matchingOrdering',
  TEXT = 'text',
}
