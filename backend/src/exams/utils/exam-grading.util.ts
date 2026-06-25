import { ExamEntity } from '../entities/exam.entity';
import { ExamQuestionEntity, QuestionTypeEnum } from '../entities/exam-question.entity';
import {
  ExamSubmissionStatusEnum,
  StudentExamSubmissionEntity,
} from '../entities/student-exam-answer.entity';
import { GradingStatusEnum } from '../enums/grading-status.enum';
import { QuestionCategoryEnum } from '../enums/question.enums';
import { isAutoScoredQuestion } from './exam-question.util';

export const FINALIZED_SUBMISSION_STATUSES = [
  ExamSubmissionStatusEnum.SUBMITTED,
  ExamSubmissionStatusEnum.AUTO_SUBMITTED,
];

export function getOrderedQuestions(exam: ExamEntity): ExamQuestionEntity[] {
  let ordered: ExamQuestionEntity[];
  if (exam.questionSections?.length) {
    const sections = [...exam.questionSections].sort((a, b) => a.sort_order - b.sort_order);
    ordered = [];
    for (const section of sections) {
      const questions = [...(section.questions || [])].sort((a, b) => a.sort_order - b.sort_order);
      ordered.push(...questions);
    }
  } else {
    ordered = [...(exam.questions || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
  }

  return ordered.filter(
    (question) => !(question.category === QuestionCategoryEnum.PASSAGE && !question.parent_id),
  );
}

export function isManualGradingQuestion(question: ExamQuestionEntity): boolean {
  return (
    question.question_type === QuestionTypeEnum.SUBJECTIVE &&
    !isAutoScoredQuestion(question.category, question.sub_type)
  );
}

export function getManualQuestions(exam: ExamEntity): ExamQuestionEntity[] {
  return getOrderedQuestions(exam).filter(isManualGradingQuestion);
}

export function getAutoScoredQuestions(exam: ExamEntity): ExamQuestionEntity[] {
  return getOrderedQuestions(exam).filter(
    (question) =>
      question.question_type === QuestionTypeEnum.OBJECTIVE ||
      isAutoScoredQuestion(question.category, question.sub_type),
  );
}

export function examHasManualQuestions(exam: ExamEntity): boolean {
  return getManualQuestions(exam).length > 0;
}

export function computeExamTotalMarks(exam: ExamEntity): number {
  return getOrderedQuestions(exam).reduce(
    (sum, question) => sum + (question.points ?? question.marks_per_question ?? 0),
    0,
  );
}

export function computeGradingStatus(
  exam: Pick<ExamEntity, 'result_published_at'>,
  hasManualQuestions: boolean,
  submittedSubmissions: Pick<StudentExamSubmissionEntity, 'is_graded'>[],
): GradingStatusEnum {
  if (exam.result_published_at) {
    return GradingStatusEnum.PUBLISHED;
  }

  if (!hasManualQuestions) {
    return GradingStatusEnum.GRADED;
  }

  if (submittedSubmissions.length === 0) {
    return GradingStatusEnum.GRADED;
  }

  const allGraded = submittedSubmissions.every((submission) => submission.is_graded);
  return allGraded ? GradingStatusEnum.GRADED : GradingStatusEnum.NEEDS_GRADING;
}

export function computePercentage(
  totalScore: number | null | undefined,
  maxScore: number | null | undefined,
): number | null {
  if (!maxScore || maxScore <= 0) {
    return null;
  }

  return Math.round(((Number(totalScore) || 0) / Number(maxScore)) * 10000) / 100;
}
