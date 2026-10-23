import { createHash } from 'crypto';

/** Sub types whose option order carries meaning (True / False / Not given) and stays fixed. */
export const FIXED_OPTION_ORDER_SUB_TYPES: readonly string[] = [
  'true-false',
  'true-false-not-given',
  'yes-no-not-given',
];

/** Keys that hold the answer key in a question response; never sent to students. */
const ANSWER_KEY_FIELDS = ['answer', 'correctOptionId', 'answer_json', 'correct_answer', 'sample_answer'];

type ServedOption = { id: string };
type ServedQuestion = Record<string, unknown>;
type ServedSubject = { questions?: ServedQuestion[] } & Record<string, unknown>;

/**
 * Deterministic Fisher–Yates shuffle. Every swap index comes from SHA-256 of
 * `seed:salt:i`, so the same seed and salt always give the same order.
 */
export function seededShuffle<T>(items: readonly T[], seed: string, salt = ''): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const digest = createHash('sha256').update(`${seed}:${salt}:${i}`).digest();
    const j = digest.readUInt32BE(0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sameOrder(a: readonly ServedOption[], b: readonly ServedOption[]): boolean {
  return a.length === b.length && a.every((option, i) => option.id === b[i].id);
}

/**
 * Shuffles the right-hand column of a matching question. The stored order is the
 * answer key (left[i] ↔ right[i]), so a shuffle that lands on it is rotated by one.
 */
export function shuffleMatchingRight<T extends ServedOption>(right: readonly T[], seed: string, questionId: string): T[] {
  const shuffled = seededShuffle(right, seed, `${questionId}:matching-right`);
  if (shuffled.length >= 2 && sameOrder(shuffled, right)) {
    shuffled.push(shuffled.shift()!);
  }
  return shuffled;
}

function stripAnswerKey(question: ServedQuestion): ServedQuestion {
  const out: ServedQuestion = { ...question };
  for (const field of ANSWER_KEY_FIELDS) {
    delete out[field];
  }
  return out;
}

function shuffleServedQuestion(question: ServedQuestion, seed: string): ServedQuestion {
  const out = stripAnswerKey(question);
  const questionId = String(out.id ?? '');
  const subType = typeof out.subType === 'string' ? out.subType : null;

  if (Array.isArray(out.options) && !(subType && FIXED_OPTION_ORDER_SUB_TYPES.includes(subType))) {
    out.options = seededShuffle(out.options as ServedOption[], seed, `${questionId}:options`);
  }

  const matching = out.matchingOptions as { left?: ServedOption[]; right?: ServedOption[] } | undefined;
  if (matching && Array.isArray(matching.right)) {
    out.matchingOptions = {
      ...matching,
      right: shuffleMatchingRight(matching.right, seed, questionId),
    };
  }

  if (Array.isArray(out.childQuestions)) {
    out.childQuestions = (out.childQuestions as ServedQuestion[]).map((child) =>
      shuffleServedQuestion(child, seed),
    );
  }

  return out;
}

/**
 * Per-student view of the exam paper: option order and the matching right column
 * are shuffled with `seed` (the submission id), and answer-key fields are removed.
 * Option ids are kept, so answers and scoring stay id-based and unambiguous.
 */
export function shuffleStudentPaper<T extends ServedSubject>(subjects: readonly T[], seed: string): T[] {
  return subjects.map((subject) => ({
    ...subject,
    questions: (subject.questions ?? []).map((question) => shuffleServedQuestion(question, seed)),
  }));
}
