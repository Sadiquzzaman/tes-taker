import { BadRequestException } from '@nestjs/common';
import {
  AUTO_SCORED_SUB_TYPES,
  AnswerValueTypeEnum,
  MANUAL_SUB_TYPES,
  QuestionCategoryEnum,
} from '../enums/question.enums';
import {
  WizardAnswerDto,
  WizardChildQuestionDto,
  WizardGradedQuestionDto,
  WizardMatchingOptionsDto,
  WizardOptionDto,
  WizardPassageQuestionDto,
  WizardUngradedQuestionDto,
} from '../dto/create-exam-wizard.dto';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ParsedWizardQuestion =
  | { kind: 'passage'; data: WizardPassageQuestionDto }
  | { kind: 'graded'; data: WizardGradedQuestionDto }
  | { kind: 'ungraded'; data: WizardUngradedQuestionDto };

export function parseWizardQuestion(raw: unknown): ParsedWizardQuestion {
  const q = (raw ?? {}) as Record<string, unknown>;
  const type = q.type as string;

  if (type === QuestionCategoryEnum.PASSAGE) {
    if (Array.isArray(q.childQuestions)) {
      return { kind: 'passage', data: q as unknown as WizardPassageQuestionDto };
    }
    if (q.subType && AUTO_SCORED_SUB_TYPES.includes(q.subType as (typeof AUTO_SCORED_SUB_TYPES)[number])) {
      return { kind: 'passage-child', data: q as unknown as WizardChildQuestionDto } as never;
    }
    throw new BadRequestException('Passage questions must include childQuestions');
  }

  if (type === QuestionCategoryEnum.GRADED) {
    return { kind: 'graded', data: q as unknown as WizardGradedQuestionDto };
  }

  if (type === QuestionCategoryEnum.UNGRADED) {
    return { kind: 'ungraded', data: q as unknown as WizardUngradedQuestionDto };
  }

  throw new BadRequestException(`Unknown question type: ${type}`);
}

export function validateSubjectQuestions(questions: unknown[]): void {
  if (!questions.length) {
    throw new BadRequestException('Each subject must include at least one question');
  }

  for (const raw of questions) {
    const parsed = parseWizardQuestion(raw);
    if (parsed.kind === 'passage') {
      validatePassageQuestion(parsed.data);
    } else if (parsed.kind === 'graded') {
      validateAutoScoredQuestion(parsed.data, 'graded');
    } else {
      validateUngradedQuestion(parsed.data);
    }
  }
}

function validatePassageQuestion(q: WizardPassageQuestionDto): void {
  if (!q.passageText?.trim()) {
    throw new BadRequestException('Passage questions require passageText');
  }
  if (!q.childQuestions?.length) {
    throw new BadRequestException('Passage questions require at least one child question');
  }
  for (const child of q.childQuestions) {
    validateAutoScoredQuestion(child, 'passage child');
  }
}

function validateUngradedQuestion(q: WizardUngradedQuestionDto): void {
  if (!q.text?.trim()) {
    throw new BadRequestException('Each question requires text');
  }
  if (!MANUAL_SUB_TYPES.includes(q.subType)) {
    throw new BadRequestException(`Invalid ungraded subType: ${q.subType}`);
  }
  normalizePoints(q.points);

  if (q.answer) {
    if (q.answer.type !== AnswerValueTypeEnum.TEXT) {
      throw new BadRequestException('Ungraded sample answers must use type "text"');
    }
    if (!Array.isArray(q.answer.value) || q.answer.value.length === 0) {
      throw new BadRequestException('Ungraded sample answers require at least one text value');
    }
  }
}

function validateAutoScoredQuestion(
  q: WizardGradedQuestionDto | WizardChildQuestionDto,
  label: string,
): void {
  if (!q.text?.trim()) {
    throw new BadRequestException(`Each ${label} question requires text`);
  }
  if (!AUTO_SCORED_SUB_TYPES.includes(q.subType)) {
    throw new BadRequestException(`Invalid subType for ${label} question: ${q.subType}`);
  }
  normalizePoints(q.points);

  if (q.subType === 'matching-ordering') {
    validateMatchingQuestion(q, label);
    return;
  }

  const options = q.options ?? [];
  const minOpts = q.subType === 'true-false' ? 3 : 3;
  const maxOpts = q.subType === 'true-false' ? 3 : 5;

  if (options.length < minOpts || options.length > maxOpts) {
    throw new BadRequestException(
      `${label} ${q.subType} requires ${minOpts}${maxOpts !== minOpts ? `–${maxOpts}` : ''} options`,
    );
  }
  assertUniqueOptionIds(options, label);

  if (!q.answer || q.answer.type !== AnswerValueTypeEnum.OPTION_ID) {
    throw new BadRequestException(`${label} ${q.subType} requires answer.type "optionId"`);
  }

  const optionIds = new Set(options.map((o) => o.id));
  const answerIds = q.answer.value ?? [];

  if (q.subType === 'multiple-response') {
    if (answerIds.length < 2) {
      throw new BadRequestException('Multiple-response questions require at least two correct options');
    }
    for (const id of answerIds) {
      if (!optionIds.has(id)) {
        throw new BadRequestException('Correct option ids must reference question options');
      }
    }
    return;
  }

  if (answerIds.length !== 1) {
    throw new BadRequestException(`${label} ${q.subType} requires exactly one correct option`);
  }
  if (!optionIds.has(answerIds[0])) {
    throw new BadRequestException('Correct option id must reference a question option');
  }
}

function validateMatchingQuestion(
  q: WizardGradedQuestionDto | WizardChildQuestionDto,
  label: string,
): void {
  const matching = q.matchingOptions;
  if (!matching?.left?.length || !matching.right?.length) {
    throw new BadRequestException(`${label} matching-ordering requires matchingOptions.left and .right`);
  }
  if (matching.left.length !== matching.right.length) {
    throw new BadRequestException('Matching-ordering left and right columns must have the same length');
  }

  assertUniqueOptionIds(matching.left, label);
  assertUniqueOptionIds(matching.right, label);

  if (!q.answer || q.answer.type !== AnswerValueTypeEnum.MATCHING_ORDERING) {
    throw new BadRequestException('Matching-ordering questions require answer.type "matchingOrdering"');
  }

  const leftIds = new Set(matching.left.map((o) => o.id));
  const rightIds = new Set(matching.right.map((o) => o.id));
  const pairs = q.answer.value ?? [];

  if (pairs.length !== matching.left.length) {
    throw new BadRequestException('Matching-ordering answer must include one pair per left item');
  }

  const usedLeft = new Set<string>();
  const usedRight = new Set<string>();

  for (const pair of pairs) {
    const [leftId, rightId] = pair.split('::');
    if (!leftId || !rightId) {
      throw new BadRequestException('Matching-ordering pairs must use leftId::rightId format');
    }
    if (!leftIds.has(leftId) || !rightIds.has(rightId)) {
      throw new BadRequestException('Matching-ordering pairs must reference valid option ids');
    }
    if (usedLeft.has(leftId) || usedRight.has(rightId)) {
      throw new BadRequestException('Matching-ordering pairs must be unique');
    }
    usedLeft.add(leftId);
    usedRight.add(rightId);
  }
}

function assertUniqueOptionIds(options: WizardOptionDto[], label: string): void {
  const ids = options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(`${label} option ids must be unique`);
  }
  for (const opt of options) {
    if (!opt.text?.trim()) {
      throw new BadRequestException('Each option requires text');
    }
  }
}

export function normalizePoints(points: unknown): number {
  const normalized = Number(points);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new BadRequestException('Each question must include a valid non-negative points value');
  }
  return normalized;
}

export function resolveQuestionId(clientId?: string): string | undefined {
  if (clientId && UUID_V4_RE.test(clientId)) {
    return clientId;
  }
  return undefined;
}

export function mapOptionsForStorage(options: WizardOptionDto[] | undefined) {
  return (options ?? []).map((o) => ({ id: o.id, text: o.text.trim() }));
}

export function mapMatchingForStorage(matching: WizardMatchingOptionsDto | undefined) {
  if (!matching) {
    return null;
  }
  return {
    left: mapOptionsForStorage(matching.left),
    right: mapOptionsForStorage(matching.right),
  };
}

export function mapAnswerForStorage(answer: WizardAnswerDto | undefined) {
  if (!answer) {
    return null;
  }
  return {
    type: answer.type,
    value: [...answer.value],
  };
}

export function syncLegacyOptionColumns(
  options: { id: string; text: string }[],
  correctOptionIds: string[],
): {
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  option5?: string | null;
  correct_option_index: number | null;
} {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < options.length; i++) {
    out[`option${i + 1}`] = options[i].text;
  }
  const primaryCorrect = correctOptionIds[0];
  const idx = primaryCorrect ? options.findIndex((o) => o.id === primaryCorrect) : -1;
  return {
    option1: out.option1 ?? undefined,
    option2: out.option2 ?? undefined,
    option3: out.option3 ?? undefined,
    option4: out.option4 ?? undefined,
    option5: out.option5 ?? null,
    correct_option_index: idx >= 0 ? idx : null,
  };
}

export function isAutoScoredQuestion(category: QuestionCategoryEnum | null, subType: string | null): boolean {
  if (!category || !subType) {
    return false;
  }
  if (category === QuestionCategoryEnum.UNGRADED) {
    return false;
  }
  return AUTO_SCORED_SUB_TYPES.includes(subType as (typeof AUTO_SCORED_SUB_TYPES)[number]);
}

export function scoreStudentAnswer(
  question: {
    category: QuestionCategoryEnum | null;
    sub_type: string | null;
    options_json: { id: string; text: string }[] | null;
    answer_json: { type: string; value: string[] } | null;
    correct_option_index: number | null;
    correct_answer?: string;
    points: number | null;
  },
  rawAnswer: string,
): boolean {
  if (!isAutoScoredQuestion(question.category, question.sub_type)) {
    return false;
  }

  const expected = question.answer_json;
  if (!expected) {
    return false;
  }

  const trimmed = rawAnswer.trim();
  if (!trimmed) {
    return false;
  }

  if (expected.type === AnswerValueTypeEnum.OPTION_ID) {
    if (question.sub_type === 'multiple-response') {
      const submitted = trimmed.split(',').map((s) => s.trim()).filter(Boolean).sort();
      const correct = [...expected.value].sort();
      return submitted.length === correct.length && submitted.every((v, i) => v === correct[i]);
    }
    return expected.value.includes(trimmed);
  }

  if (expected.type === AnswerValueTypeEnum.MATCHING_ORDERING) {
    const submitted = trimmed.split('|').map((s) => s.trim()).filter(Boolean).sort();
    const correct = [...expected.value].sort();
    return submitted.length === correct.length && submitted.every((v, i) => v === correct[i]);
  }

  return false;
}
