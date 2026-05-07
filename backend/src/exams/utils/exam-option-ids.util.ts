import { createHash } from 'crypto';
import {
  ExamQuestionEntity,
  CORRECT_ANSWER_ENUM_BY_OPTION_INDEX,
  CorrectAnswerEnum,
} from '../entities/exam-question.entity';

/** Same algorithm as teacher-facing `formatQuestionResponse` option ids. */
export function buildResponseOptionId(questionId: string, index: number): string {
  const hex = createHash('sha256')
    .update(`${questionId}:${index}`)
    .digest('hex')
    .slice(0, 32)
    .split('');

  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];

  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

/** Count of MCQ option slots to expose (matches persisted columns + correct index). */
export function getObjectiveOptionSlotCount(question: ExamQuestionEntity): number {
  const rawTexts = [
    question.option1,
    question.option2,
    question.option3,
    question.option4,
    question.option5,
  ] as (string | null | undefined)[];

  let lastFilled = -1;
  for (let i = 0; i < rawTexts.length; i++) {
    if (rawTexts[i]?.trim()) {
      lastFilled = i;
    }
  }

  const correctIndex =
    question.correct_option_index ??
    (question.correct_answer != null
      ? CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(question.correct_answer as CorrectAnswerEnum)
      : -1);

  return Math.max(lastFilled + 1, correctIndex >= 0 ? correctIndex + 1 : 0, 1);
}

/** Resolve submitted option UUID to 0-based index, or null if invalid. */
export function findObjectiveOptionIndexBySubmittedId(
  questionId: string,
  submittedOptionId: string,
  optionSlotCount: number,
): number | null {
  const trimmed = submittedOptionId?.trim();
  if (!trimmed) {
    return null;
  }
  for (let i = 0; i < optionSlotCount; i++) {
    if (buildResponseOptionId(questionId, i) === trimmed) {
      return i;
    }
  }
  return null;
}
