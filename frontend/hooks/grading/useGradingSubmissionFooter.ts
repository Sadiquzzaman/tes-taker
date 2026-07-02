"use client";

import useSaveSubmissionGrades from "@/hooks/api/grading/useSaveSubmissionGrades";
import { useApiError } from "@/hooks/api/useApiError";
import fetchGradingSummary from "@/utils/grading/fetchGradingSummary";
import getSubmissionGradeValidationError from "@/utils/grading/getSubmissionGradeValidationError";
import { cacheSubmissionSaveResponse, selectSubmissionGradingEntry } from "@/lib/features/gradingSubmissionSlice";
import { setGradeDetailsData, setOpenModal } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { AxiosError } from "axios";

const useGradingSubmissionFooter = () => {
  const dispatch = useAppDispatch();
  const { handleError } = useApiError();
  const { currentPage, exam, openModal, searchStudentInput, selectedSubmission } = useAppSelector((state) => state.gradeDetails);
  const examId = exam?.id ?? null;
  const submissionId = selectedSubmission?.submission_id ?? null;
  const cachedEntry = useAppSelector((state) => selectSubmissionGradingEntry(state, examId, submissionId));
  const [saveSubmissionGrades, { loading: isSubmitting }] = useSaveSubmissionGrades();

  const data = cachedEntry?.apiResponse ?? null;
  const grades = cachedEntry?.graded ?? [];

  const validationErrors = grades.reduce<GradingSubmissionValidationErrorMap>((errors, grade) => {
    const question = data?.items.find((item) => item.kind === "question" && item.question.id === grade.question_id);

    if (!question || question.kind !== "question") {
      return errors;
    }

    const validationError = getSubmissionGradeValidationError(grade.marks_obtained, question.question.points);

    if (validationError) {
      errors[grade.question_id] = validationError;
    }

    return errors;
  }, {});

  const isSubmitDisabled = !data || openModal !== "edit" || grades.length === 0 || Object.keys(validationErrors).length > 0 || isSubmitting;

  const handleClose = () => {
    dispatch(setOpenModal(""));
  };

  const handleSubmit = async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (!examId || !submissionId || isSubmitDisabled) {
      return;
    }

    const payload: SaveSubmissionGradesPayload = {
      grades: grades.map((grade) => ({
        question_id: grade.question_id,
        marks_obtained: grade.marks_obtained,
        explanation: grade.explanation,
      })),
    };

    const response = await saveSubmissionGrades({
      examId,
      submissionId,
      payload,
    });

    if (response?.status !== 200 || !response.data.payload) {
      return;
    }

    dispatch(
      cacheSubmissionSaveResponse({
        examId,
        submissionId,
        saveResponse: response.data.payload,
        graded: grades,
      }),
    );

    try {
      const summaryResponse = await fetchGradingSummary({
        examId,
        currentPage,
        search: searchStudentInput,
      });

      if (summaryResponse.status === 200) {
        dispatch(
          setGradeDetailsData({
            exam: summaryResponse.data.payload.exam,
            stats: summaryResponse.data.payload.stats,
            submissions: summaryResponse.data.payload.submissions,
            meta: summaryResponse.data.meta,
          }),
        );
      }
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    }

    handleClose();
  };

  return {
    handleClose,
    handleSubmit,
    isSubmitting,
    isSubmitDisabled,
  } as const;
};

export default useGradingSubmissionFooter;
