import { IeltsAnswerKey } from './entities/ielts-question.entity';
import { IeltsGroupTypeEnum, wordCount } from './question-groups';

/** A written answer as compared: lower case, single spaces, no spaces at the ends. */
export const normalise = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** The keys a student chose, from "B" or "B,D". */
export const keysOf = (answer: string): string[] =>
  answer
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

/**
 * Marks for one answer (IEL-04, IEL-05): a written answer is right when it matches an accepted
 * spelling (case and extra spaces do not matter) and keeps to the word limit; a choice when the
 * key is right. "Choose TWO letters" gives a mark per right letter, in any order, but choosing
 * more letters than asked gives nothing.
 */
export function marksFor(type: string, key: IeltsAnswerKey, wordLimit: number | null, answer: string | null): number {
  if (!answer?.trim()) return 0;
  if ('accepted' in key) {
    if (wordLimit && wordCount(answer) > wordLimit) return 0;
    return key.accepted.some((a) => normalise(a) === normalise(answer)) ? 1 : 0;
  }
  const chosen = [...new Set(keysOf(answer))];
  if (type === IeltsGroupTypeEnum.MCQ_MULTI) {
    if (chosen.length > key.keys.length) return 0;
    return chosen.filter((k) => key.keys.includes(k)).length;
  }
  return chosen.length === 1 && key.keys.includes(chosen[0]) ? 1 : 0;
}
