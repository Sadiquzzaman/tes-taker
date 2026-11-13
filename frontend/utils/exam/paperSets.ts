import { PDF_OPTION_LABELS } from "./pdf/pdfConstants";
import { groupExamQuestionsForPdf } from "./pdf/groupExamQuestionsForPdf";

/** Printed sets of one paper (QA-05): A keeps the teacher's order; B and C shuffle it. */
export const PAPER_SETS = ["A", "B", "C"] as const;
export type PaperSet = (typeof PAPER_SETS)[number];

/** Option orders that carry meaning (True / False / Not given) stay fixed, as on screen. */
const FIXED_OPTION_ORDER: readonly string[] = ["true-false", "true-false-not-given", "yes-no-not-given"];

/** A small deterministic hash (FNV-1a) → 32-bit number. */
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Deterministic Fisher–Yates: the same seed and salt always give the same order. */
export const seededShuffle = <T,>(items: readonly T[], seed: string, salt: string): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = hash(`${seed}:${salt}:${i}`) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

type MatchingOptions = { left: StudentExamMatchingOption[]; right: StudentExamMatchingOption[] };
type Shufflable = { id: string; subType?: string; options?: StudentExamOption[]; matchingOptions?: MatchingOptions };

/**
 * The right column of a matching question. Stored, it is the answer key (left 1 ↔ right 1), so it
 * is always shuffled, in every set, and a shuffle that lands on the key is turned by one.
 */
const shuffleRight = (right: StudentExamMatchingOption[], seed: string, questionId: string) => {
  const shuffled = seededShuffle(right, seed, `${questionId}:right`);
  if (shuffled.length >= 2 && shuffled.every((option, i) => option.id === right[i].id)) shuffled.push(shuffled.shift()!);
  return shuffled;
};

const shuffleQuestion = <Q extends Shufflable>(question: Q, seed: string, shuffleOptions: boolean): Q => {
  const out: Q = { ...question };
  if (shuffleOptions && out.options?.length && !(out.subType && FIXED_OPTION_ORDER.includes(out.subType))) {
    out.options = seededShuffle(out.options, seed, `${question.id}:options`);
  }
  if (out.matchingOptions?.right?.length) {
    out.matchingOptions = { ...out.matchingOptions, right: shuffleRight(out.matchingOptions.right, seed, question.id) };
  }
  return out;
};

/**
 * One set of the paper. Set A keeps the order of questions and options; B and C shuffle the
 * questions (within their kind, as the paper groups them) and the options of each question.
 * Passages keep their questions in order (they follow the text) but shuffle the options.
 */
export const paperSet = (subjects: StudentExamSubject[], examId: string, set: PaperSet): StudentExamSubject[] => {
  const seed = `${examId}:${set}`;
  const shuffled = set !== "A";
  return subjects.map((subject) => {
    const questions = subject.questions.map((question) => {
      if ("childQuestions" in question && Array.isArray(question.childQuestions)) {
        return { ...question, childQuestions: question.childQuestions.map((child) => shuffleQuestion(child, seed, shuffled)) };
      }
      return shuffleQuestion(question as StudentExamStandardQuestion, seed, shuffled);
    });
    return { ...subject, questions: shuffled ? seededShuffle(questions, seed, `${subject.id}:questions`) : questions };
  });
};

export interface AnswerKeyRow {
  number: number;
  /** "C", or for matching "1-B, 2-A"; null when the answer is written (marked by the teacher). */
  answer: string | null;
}

type KeyQuestion = { subType?: string; options?: StudentExamOption[]; matchingOptions?: MatchingOptions; correctOptionId?: string | null };

const answerOf = (question: KeyQuestion, originalRight: Map<string, StudentExamMatchingOption[]>, id: string): string | null => {
  if (question.matchingOptions?.left?.length) {
    const right = question.matchingOptions.right;
    const stored = originalRight.get(id) ?? right;
    // Stored, left[i] matches stored right[i]; on paper that item has a new letter.
    return question.matchingOptions.left
      .map((_, i) => {
        const index = right.findIndex((option) => option.id === stored[i]?.id);
        return index >= 0 ? `${i + 1}-${PDF_OPTION_LABELS[index]}` : null;
      })
      .filter(Boolean)
      .join(", ");
  }
  // Several right answers: the paper's key cannot show them from one id; marked by the teacher.
  if (question.subType === "multiple-response" || !question.correctOptionId || !question.options?.length) return null;
  const index = question.options.findIndex((option) => option.id === question.correctOptionId);
  return index >= 0 ? PDF_OPTION_LABELS[index] : null;
};

/**
 * The answer key of a set, numbered as the paper prints it (per subject: each kind of question in
 * turn, then the passages). `original` is the paper as stored, for matching questions.
 */
export const answerKey = (set: StudentExamSubject[], original: StudentExamSubject[]): { subject: StudentExamSubject; rows: AnswerKeyRow[] }[] => {
  const originalRight = new Map<string, StudentExamMatchingOption[]>();
  for (const subject of original) {
    for (const question of subject.questions) {
      const all = "childQuestions" in question && Array.isArray(question.childQuestions) ? question.childQuestions : [question];
      for (const q of all as (KeyQuestion & { id: string })[]) if (q.matchingOptions?.right) originalRight.set(q.id, q.matchingOptions.right);
    }
  }
  return set.map((subject) => {
    const layout = groupExamQuestionsForPdf(subject);
    const rows: AnswerKeyRow[] = [];
    let number = 1;
    for (const group of layout.groups) {
      for (const question of group.questions) rows.push({ number: number++, answer: answerOf(question, originalRight, question.id) });
    }
    for (const { passage } of layout.passages) {
      for (const child of passage.childQuestions) rows.push({ number: number++, answer: answerOf(child, originalRight, child.id) });
    }
    return { subject, rows };
  });
};
