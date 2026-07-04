import { normalizeSubmissionGradingDetail } from "@/utils/grading/normalizeSubmissionGradingDetail";

export const mapStudentExamResult = (result: StudentExamResultPayload): GradingModalData => {
  return normalizeSubmissionGradingDetail({
    submission: result.submission,
    questions: result.questions,
    totals: result.totals,
  });
};
