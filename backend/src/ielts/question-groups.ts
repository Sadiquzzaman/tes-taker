import { IeltsModuleEnum } from './entities/ielts-profile.entity';
import { IeltsGroupShared, IeltsOption } from './entities/ielts-question-group.entity';
import { IeltsAnswerKey } from './entities/ielts-question.entity';

/** The question group types of the real paper (IEL-03). */
export enum IeltsGroupTypeEnum {
  MCQ_SINGLE = 'MCQ_SINGLE',
  MCQ_MULTI = 'MCQ_MULTI',
  TFNG = 'TFNG',
  YNNG = 'YNNG',
  MATCH_HEADINGS = 'MATCH_HEADINGS',
  MATCH_INFO = 'MATCH_INFO',
  MATCH_FEATURES = 'MATCH_FEATURES',
  MATCH_ENDINGS = 'MATCH_ENDINGS',
  SENTENCE_COMPLETION = 'SENTENCE_COMPLETION',
  SUMMARY_COMPLETION = 'SUMMARY_COMPLETION',
  NOTE_COMPLETION = 'NOTE_COMPLETION',
  TABLE_COMPLETION = 'TABLE_COMPLETION',
  FLOWCHART_COMPLETION = 'FLOWCHART_COMPLETION',
  FORM_COMPLETION = 'FORM_COMPLETION',
  DIAGRAM_LABEL = 'DIAGRAM_LABEL',
  SHORT_ANSWER = 'SHORT_ANSWER',
}

type Choices = 'question' | 'shared' | 'fixed' | 'text';

interface GroupRule {
  /** Where the choices come from: the question's own options, the group's shared list, a fixed set, or written answers. */
  choices: Choices;
  modules: readonly IeltsModuleEnum[];
  fixed?: readonly string[];
}

const LR = [IeltsModuleEnum.LISTENING, IeltsModuleEnum.READING] as const;
const R = [IeltsModuleEnum.READING] as const;

export const GROUP_RULES: Record<IeltsGroupTypeEnum, GroupRule> = {
  [IeltsGroupTypeEnum.MCQ_SINGLE]: { choices: 'question', modules: LR },
  [IeltsGroupTypeEnum.MCQ_MULTI]: { choices: 'question', modules: LR },
  [IeltsGroupTypeEnum.TFNG]: { choices: 'fixed', modules: R, fixed: ['TRUE', 'FALSE', 'NOT GIVEN'] },
  [IeltsGroupTypeEnum.YNNG]: { choices: 'fixed', modules: R, fixed: ['YES', 'NO', 'NOT GIVEN'] },
  [IeltsGroupTypeEnum.MATCH_HEADINGS]: { choices: 'shared', modules: R },
  [IeltsGroupTypeEnum.MATCH_INFO]: { choices: 'shared', modules: R },
  [IeltsGroupTypeEnum.MATCH_FEATURES]: { choices: 'shared', modules: LR },
  [IeltsGroupTypeEnum.MATCH_ENDINGS]: { choices: 'shared', modules: R },
  [IeltsGroupTypeEnum.SENTENCE_COMPLETION]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.SUMMARY_COMPLETION]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.NOTE_COMPLETION]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.TABLE_COMPLETION]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.FLOWCHART_COMPLETION]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.FORM_COMPLETION]: { choices: 'text', modules: [IeltsModuleEnum.LISTENING] },
  [IeltsGroupTypeEnum.DIAGRAM_LABEL]: { choices: 'text', modules: LR },
  [IeltsGroupTypeEnum.SHORT_ANSWER]: { choices: 'text', modules: LR },
};

export interface GroupInput {
  type: IeltsGroupTypeEnum;
  instruction: string;
  word_limit?: number | null;
  shared?: IeltsGroupShared | null;
  questions: { prompt?: string | null; options?: IeltsOption[] | null; answer: IeltsAnswerKey }[];
}

/** Words in a written answer; numbers do not count ("NO MORE THAN TWO WORDS AND/OR A NUMBER"). */
export const wordCount = (text: string): number => text.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;

/** How many numbers (1–40) a question takes: "Choose TWO letters" takes two. */
export const numbersTaken = (type: string, answer: IeltsAnswerKey): number =>
  type === IeltsGroupTypeEnum.MCQ_MULTI && 'keys' in answer ? answer.keys.length : 1;

const validOptions = (options: unknown, min: number, max: number): options is IeltsOption[] => {
  if (!Array.isArray(options) || options.length < min || options.length > max) return false;
  const keys = options.map((o: Partial<IeltsOption>) => (typeof o?.key === 'string' ? o.key.trim() : ''));
  return (
    options.every((o: Partial<IeltsOption>) => typeof o?.text === 'string' && o.text.trim().length > 0 && o.text.length <= 500) &&
    keys.every((k) => k.length > 0 && k.length <= 8) &&
    new Set(keys).size === keys.length
  );
};

/**
 * Why a question group cannot be saved, or null when it can. Messages are plain English for the
 * builder; the rules follow the real paper.
 */
export function groupProblem(module: IeltsModuleEnum, group: GroupInput): string | null {
  const rule = GROUP_RULES[group.type];
  if (!rule) return 'Unknown question type';
  if (!rule.modules.includes(module)) return `${group.type} is not used in ${module}`;
  if (!group.instruction?.trim() || group.instruction.length > 2000) return 'Write the instruction (up to 2000 characters)';
  if (group.word_limit !== undefined && group.word_limit !== null) {
    if (rule.choices !== 'text') return 'Only written answers have a word limit';
    if (!Number.isInteger(group.word_limit) || group.word_limit < 1 || group.word_limit > 5) return 'The word limit is 1 to 5 words';
  }
  const sharedOptions = group.shared?.options;
  if (rule.choices === 'shared' && !validOptions(sharedOptions, 2, 26)) return 'Give the list to choose from: 2 to 26 items with different letters';
  if (rule.choices === 'text' && sharedOptions !== undefined && !validOptions(sharedOptions, 2, 26)) return 'A word box has 2 to 26 items with different letters';
  if (group.shared?.text !== undefined && (rule.choices !== 'text' || typeof group.shared.text !== 'string' || group.shared.text.length > 20_000)) {
    return 'Only completion questions have a text with gaps (up to 20000 characters)';
  }
  if (!Array.isArray(group.questions) || group.questions.length < 1 || group.questions.length > 40) return 'A group has 1 to 40 questions';

  for (const [i, q] of group.questions.entries()) {
    const at = `Question ${i + 1}: `;
    if (q.prompt !== undefined && q.prompt !== null && (typeof q.prompt !== 'string' || q.prompt.length > 2000)) return `${at}the question is up to 2000 characters`;
    const needsPrompt = rule.choices !== 'text' || group.type === IeltsGroupTypeEnum.SHORT_ANSWER || group.type === IeltsGroupTypeEnum.SENTENCE_COMPLETION;
    if (needsPrompt && !q.prompt?.trim()) return `${at}write the question`;
    if (rule.choices === 'question') {
      if (!validOptions(q.options, 2, 10)) return `${at}give 2 to 10 options with different letters`;
    } else if (q.options !== undefined && q.options !== null) {
      return `${at}only multiple choice questions have their own options`;
    }
    const allowed =
      rule.choices === 'question' ? q.options?.map((o) => o.key.trim()) : rule.choices === 'fixed' ? rule.fixed : sharedOptions?.map((o) => o.key.trim());
    if (allowed) {
      if (!q.answer || !('keys' in q.answer) || !Array.isArray(q.answer.keys)) return `${at}choose the right answer`;
      const keys = q.answer.keys;
      if (new Set(keys).size !== keys.length || keys.some((k) => !allowed.includes(k))) return `${at}the answer must be one of the choices`;
      if (group.type === IeltsGroupTypeEnum.MCQ_MULTI) {
        if (keys.length < 2 || keys.length >= (q.options?.length ?? 0)) return `${at}choose at least two right answers, fewer than the options`;
      } else if (keys.length !== 1) {
        return `${at}choose one right answer`;
      }
    } else {
      if (!q.answer || !('accepted' in q.answer) || !Array.isArray(q.answer.accepted)) return `${at}write the accepted answers`;
      const accepted = q.answer.accepted;
      if (accepted.length < 1 || accepted.length > 10 || accepted.some((a) => typeof a !== 'string' || !a.trim() || a.length > 100)) {
        return `${at}write 1 to 10 accepted answers (up to 100 characters each)`;
      }
      if (group.word_limit && accepted.some((a) => wordCount(a) > (group.word_limit as number))) return `${at}an accepted answer is longer than the word limit`;
    }
  }
  return null;
}

/** The answer as stored: trimmed keys, or trimmed accepted answers with single spaces. */
export const cleanAnswer = (answer: IeltsAnswerKey): IeltsAnswerKey =>
  'keys' in answer ? { keys: answer.keys.map((k) => k.trim()) } : { accepted: answer.accepted.map((a) => a.trim().replace(/\s+/g, ' ')) };

/** SQL for the numbers a module's live questions take (MCQ_MULTI takes one per right answer). */
export const MODULE_NUMBERS_SQL = `
  SELECT COALESCE(SUM(CASE WHEN g.type = 'MCQ_MULTI' THEN jsonb_array_length(q.answer->'keys') ELSE 1 END), 0)::int AS n
    FROM ielts_questions q
    JOIN ielts_question_groups g ON g.id = q.group_id AND g.deleted_at IS NULL
    JOIN ielts_test_parts p ON p.id = g.part_id
   WHERE p.test_id = $1 AND p.module = $2 AND q.deleted_at IS NULL`;

/** A module has at most 40 numbers; a mock's Listening and Reading have exactly 40. */
export const MODULE_NUMBERS = 40;
