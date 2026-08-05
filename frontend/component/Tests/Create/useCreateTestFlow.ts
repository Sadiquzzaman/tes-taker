"use client";

import { useCallback } from "react";
import { goToNextStep, goToPreviousStep, setQuestionValidationState } from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { collectQuestionValidationFailures, getSubjectQuestionCount } from "@/utils/createTestValidation";
import { useToast } from "@/component/Toast/ToastContext";
import useCreateTest from "@/hooks/api/tests/useCreateTest";
import useUpdateTest from "@/hooks/api/tests/useUpdateTest";

const handlePublishStateForSubmission = (publishState: PublishState) => {
  const result: PublishStateForPayload = {
    testAudience: publishState.testAudience,
    publishTiming: publishState.publishTiming,
    scheduleAt: publishState.scheduleAt,
    endingAt: publishState.endingAt,
  };

  if (publishState.testAudience === "selected_class") {
    result.selectedClassId = publishState.selectedClassId;
    result.excluded_students = publishState.excluded_students;
  }

  return result;
};

const useCreateTestFlow = (createTestState: CreateTestState) => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const { currentStep, formState, subjects, questionOrder, publishState, editExamId } = createTestState;
  const [createMutate, { loading: createLoading }] = useCreateTest();
  const [updateMutate, { loading: updateLoading }] = useUpdateTest(editExamId);
  const isEditing = Boolean(editExamId);
  const mutate = isEditing ? updateMutate : createMutate;
  const loading = isEditing ? updateLoading : createLoading;

  const handleNextStep = useCallback(async () => {
    if (currentStep === "Basic info") {
      if (!formState.testName.trim()) {
        triggerToast({ description: "Please enter a test name", type: "error" });
        return;
      }

      if (!formState.duration) {
        triggerToast({ description: "Please enter a duration", type: "error" });
        return;
      }

      if (formState.allowNegativeMarking && !formState.negativeMarking) {
        triggerToast({ description: "Please enter a negative marking value", type: "error" });
        return;
      }
    }

    if (currentStep === "Questions") {
      const subjectsWithQuestions = subjects.filter((subject) => getSubjectQuestionCount(subject) > 0);

      if (subjectsWithQuestions.length === 0) {
        triggerToast({ description: "Please add at least one question before continuing", type: "error" });
        return;
      }

      const questionWithoutSubject = subjectsWithQuestions.some((subject) =>
        subject.questions.some((question) => !question.id || !subject.id),
      );

      if (questionWithoutSubject) {
        triggerToast({ description: "Every question must have a subject", type: "error" });
        return;
      }

      const validationFailures = collectQuestionValidationFailures(subjectsWithQuestions);

      dispatch(
        setQuestionValidationState(
          validationFailures.map(({ subjectId, questionId, parentPassageId, targetType }) => ({
            subjectId,
            questionId,
            parentPassageId,
            targetType,
          })),
        ),
      );

      if (validationFailures.length > 0) {
        triggerToast({
          description: "Please fix the highlighted question errors before continuing",
          type: "error",
        });
        return;
      }
    }

    if (currentStep === "Publish") {
      if (publishState.publishTiming === "later" && (!publishState.scheduleAt || !publishState.endingAt)) {
        triggerToast({
          description: "Please select the full schedule and ending date/time",
          type: "error",
        });
        return;
      }

      if (publishState.testAudience === "selected_class" && !publishState.selectedClassId) {
        triggerToast({ description: "Please select at least one class", type: "error" });
        return;
      }

      await mutate({
        formState,
        subjects: subjects.filter((subject) => getSubjectQuestionCount(subject) > 0),
        questionOrder:
          questionOrder.length > 0
            ? questionOrder
            : subjects.flatMap((subject) => subject.questions.map((question) => question.id)),
        publishState: handlePublishStateForSubmission(publishState),
      });
      return;
    }

    dispatch(goToNextStep());
  }, [currentStep, dispatch, formState, mutate, publishState, questionOrder, subjects, triggerToast]);

  const handlePreviousStep = useCallback(() => {
    dispatch(goToPreviousStep());
  }, [dispatch]);

  return {
    handleNextStep,
    handlePreviousStep,
    isFirstStep: currentStep === "Basic info",
    isSubmitting: loading,
  };
};

export default useCreateTestFlow;
