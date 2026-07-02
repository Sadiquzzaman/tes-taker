import { ExamEntity } from '../entities/exam.entity';
import {
  CORRECT_ANSWER_ENUM_BY_OPTION_INDEX,
  ExamQuestionEntity,
  QuestionTypeEnum,
} from '../entities/exam-question.entity';
import { StudentExamAnswerEntity, StudentExamSubmissionEntity } from '../entities/student-exam-answer.entity';
import { AnswerValueTypeEnum, QuestionCategoryEnum } from '../enums/question.enums';
import { buildResponseOptionId } from './exam-option-ids.util';
import { computeExamTotalMarks, isManualGradingQuestion } from './exam-grading.util';
import { isAutoScoredQuestion } from './exam-question.util';

export type SubmissionOptionResponse = {
  id: string;
  text: string;
  image_url: string | null;
};

export type SubmissionMatchingOptionResponse = {
  id: string;
  text: string;
  image: string | null;
};

export type SubmissionAnswerResponse =
  | {
      type: 'optionId';
      correct_answer: string[];
      student_selected: string[];
    }
  | {
      type: 'matchingOrdering';
      correct_answer: string[];
      student_selected: string[];
    }
  | {
      type: 'text';
      student_answer: string;
      explanation?: string | null;
    };

export type SubmissionQuestionResponse = {
  question_id: string;
  question: string;
  instruction: string;
  image_url: string | null;
  points: number;
  type: string;
  sub_type: string;
  options?: SubmissionOptionResponse[];
  matchingOptions?: {
    left: SubmissionMatchingOptionResponse[];
    right: SubmissionMatchingOptionResponse[];
  };
  answer: SubmissionAnswerResponse;
  is_correct: boolean | null;
  marks_obtained: number;
};

export type SubmissionPassageQuestionResponse = {
  id: string;
  type: 'passage-question';
  passageText: string;
  childQuestions: SubmissionQuestionResponse[];
};

export type SubmissionQuestionItem = SubmissionQuestionResponse | SubmissionPassageQuestionResponse;

const getAllExamQuestions = (exam: ExamEntity): ExamQuestionEntity[] => {
  if (exam.questionSections?.length) {
    const sections = [...exam.questionSections].sort((a, b) => a.sort_order - b.sort_order);
    const ordered: ExamQuestionEntity[] = [];
    for (const section of sections) {
      const questions = [...(section.questions || [])].sort((a, b) => a.sort_order - b.sort_order);
      ordered.push(...questions);
    }
    return ordered;
  }

  return [...(exam.questions || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
};

export const getOrderedTopLevelQuestions = (exam: ExamEntity): ExamQuestionEntity[] =>
  getAllExamQuestions(exam).filter((question) => !question.parent_id);

const resolveStudentSelected = (
  answer: StudentExamAnswerEntity | undefined,
  question: ExamQuestionEntity,
): string[] => {
  if (!answer) {
    return [];
  }

  if (question.sub_type === 'multiple-response') {
    return (answer.text_answer ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (question.sub_type === 'matching-ordering') {
    return (answer.text_answer ?? '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  if (answer.text_answer?.trim()) {
    return [answer.text_answer.trim()];
  }

  if (answer.selected_answer && question.options_json?.length) {
    const index = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(answer.selected_answer);
    if (index >= 0 && question.options_json[index]) {
      return [question.options_json[index].id];
    }
  }

  if (answer.selected_answer) {
    const index = CORRECT_ANSWER_ENUM_BY_OPTION_INDEX.indexOf(answer.selected_answer);
    if (index >= 0) {
      return [buildResponseOptionId(question.id, index)];
    }
  }

  return [];
};

const buildSubmissionAnswer = (
  question: ExamQuestionEntity,
  answer: StudentExamAnswerEntity | undefined,
): SubmissionAnswerResponse => {
  if (question.category === QuestionCategoryEnum.UNGRADED) {
    return {
      type: 'text',
      student_answer: answer?.text_answer ?? '',
      explanation: answer?.grader_explanation ?? null,
    };
  }

  if (question.sub_type === 'matching-ordering') {
    return {
      type: 'matchingOrdering',
      correct_answer: [...(question.answer_json?.value ?? [])],
      student_selected: resolveStudentSelected(answer, question),
    };
  }

  if (
    question.question_type === QuestionTypeEnum.SUBJECTIVE &&
    !isAutoScoredQuestion(question.category, question.sub_type)
  ) {
    return {
      type: 'text',
      student_answer: answer?.text_answer ?? '',
      explanation: answer?.grader_explanation ?? null,
    };
  }

  return {
    type: 'optionId',
    correct_answer: [...(question.answer_json?.value ?? [])],
    student_selected: resolveStudentSelected(answer, question),
  };
};

const formatSubmissionQuestion = (
  question: ExamQuestionEntity,
  answer: StudentExamAnswerEntity | undefined,
  isPassageChild: boolean,
): SubmissionQuestionResponse => {
  const isManual =
    question.category === QuestionCategoryEnum.UNGRADED || isManualGradingQuestion(question);

  const response: SubmissionQuestionResponse = {
    question_id: question.id,
    question: question.question,
    instruction: question.instruction ?? '',
    image_url: question.image_url ?? null,
    points: question.points ?? question.marks_per_question ?? 0,
    type: isPassageChild
      ? QuestionCategoryEnum.PASSAGE
      : (question.category ?? QuestionCategoryEnum.GRADED),
    sub_type: question.sub_type ?? '',
    answer: buildSubmissionAnswer(question, answer),
    is_correct: isManual
      ? answer?.marks_obtained !== undefined && answer?.marks_obtained !== null
        ? (answer.is_correct ?? null)
        : null
      : (answer?.is_correct ?? false),
    marks_obtained:
      answer?.marks_obtained !== undefined && answer?.marks_obtained !== null
        ? Number(answer.marks_obtained)
        : 0,
  };

  if (question.options_json?.length) {
    response.options = question.options_json.map((option) => ({
      id: option.id,
      text: option.text,
      image_url: null,
    }));
  }

  if (question.sub_type === 'matching-ordering' && question.matching_options_json) {
    response.matchingOptions = {
      left: question.matching_options_json.left.map((option) => ({
        id: option.id,
        text: option.text,
        image: null,
      })),
      right: question.matching_options_json.right.map((option) => ({
        id: option.id,
        text: option.text,
        image: null,
      })),
    };
  }

  return response;
};

const formatSubmissionPassageQuestion = (
  question: ExamQuestionEntity,
  childrenByParent: Map<string, ExamQuestionEntity[]>,
  answerByQuestionId: Map<string, StudentExamAnswerEntity>,
): SubmissionPassageQuestionResponse => {
  const children = (childrenByParent.get(question.id) ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((child) =>
      formatSubmissionQuestion(child, answerByQuestionId.get(child.id), true),
    );

  return {
    id: question.id,
    type: QuestionCategoryEnum.PASSAGE,
    passageText: question.passage_text ?? question.question,
    childQuestions: children,
  };
};

export const buildSubmissionQuestions = (
  exam: ExamEntity,
  answerByQuestionId: Map<string, StudentExamAnswerEntity>,
): SubmissionQuestionItem[] => {
  const allQuestions = getAllExamQuestions(exam);
  const childrenByParent = new Map<string, ExamQuestionEntity[]>();

  for (const question of allQuestions) {
    if (!question.parent_id) {
      continue;
    }
    const list = childrenByParent.get(question.parent_id) ?? [];
    list.push(question);
    childrenByParent.set(question.parent_id, list);
  }

  return getOrderedTopLevelQuestions(exam).map((question) => {
    if (question.category === QuestionCategoryEnum.PASSAGE && !question.parent_id) {
      return formatSubmissionPassageQuestion(question, childrenByParent, answerByQuestionId);
    }

    return formatSubmissionQuestion(question, answerByQuestionId.get(question.id), false);
  });
};

export const resolveSubmissionScores = (
  exam: ExamEntity,
  answers: StudentExamAnswerEntity[],
): { total_score: number; max_score: number; percentage: number } => {
  const max_score = computeExamTotalMarks(exam);
  const total_score = answers.reduce((sum, answer) => {
    if (answer.marks_obtained === undefined || answer.marks_obtained === null) {
      return sum;
    }
    return sum + Number(answer.marks_obtained);
  }, 0);

  const percentage =
    max_score > 0 ? Math.round((total_score / max_score) * 10000) / 100 : 0;

  return { total_score, max_score, percentage };
};

export const persistSubmissionScores = (
  submission: StudentExamSubmissionEntity,
  scores: { total_score: number; max_score: number; percentage: number },
): void => {
  submission.total_score = scores.total_score;
  submission.max_score = scores.max_score;
};
