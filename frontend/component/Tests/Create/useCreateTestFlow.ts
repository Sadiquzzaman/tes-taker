"use client";

import { useCallback } from "react";
import {
  goToNextStep,
  goToPreviousStep,
  setQuestionValidationState,
} from "@/lib/features/createTestSlice";
import { useAppDispatch } from "@/lib/hooks";
import { collectQuestionValidationFailures, getSubjectQuestionCount } from "@/utils/createTestValidation";
import { useToast } from "@/component/Toast/ToastContext";
import useCreateTest from "@/hooks/api/tests/useCreateTest";

const sanitizeSubjectsForSubmission = (subjects: SubjectItem[]) =>
  subjects.map((subject) => ({
    ...subject,
    questionSections: subject.questionSections.filter((section) => section.questions.length > 0),
  }));

const handlePublishStateForSubmission = (publishState: PublishState) => {
    let result:PublishStateForPayload = {
        testAudience: publishState.testAudience,
        publishTiming: publishState.publishTiming,
        scheduleAt: publishState.scheduleAt,
        endingAt: publishState.endingAt,
    }

    if(publishState.testAudience === "selected_class") {
        result.selectedClassId = publishState.selectedClassId;
        result.excluded_students = publishState.excluded_students;
    }

    return result;
}

const useCreateTestFlow = (createTestState: CreateTestState) => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const [mutate, { loading }] = useCreateTest();
  const { currentStep, formState, subjects, publishState } = createTestState;

  const handleNextStep = useCallback(async () => {
    if (currentStep === "Basic info") {
      if (!formState.examType) {
        triggerToast({ description: "Please select an exam type", type: "error" });
        return;
      }

      if (!formState.testName.trim()) {
        triggerToast({ description: "Please enter a test name", type: "error" });
        return;
      }

      if (formState.examType !== "model" && subjects.length === 0) {
        triggerToast({ description: "Please select a subject", type: "error" });
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
      if (subjects.length === 0) {
        triggerToast({ description: "Please add at least one subject before continuing", type: "error" });
        return;
      }

      const subjectWithoutQuestions = subjects.find((subject) => getSubjectQuestionCount(subject) === 0);

      if (subjectWithoutQuestions) {
        triggerToast({
          description: `Please add at least one question for ${subjectWithoutQuestions.name} before continuing`,
          type: "error",
        });
        return;
      }

      const validationFailures = collectQuestionValidationFailures(subjects);

      dispatch(
        setQuestionValidationState(
          validationFailures.map(({ subjectId, sectionId, questionId }) => ({
            subjectId,
            sectionId,
            questionId,
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
        subjects: sanitizeSubjectsForSubmission(subjects),
        publishState: handlePublishStateForSubmission(publishState),
      });
      return;
    }

    dispatch(goToNextStep());
  }, [currentStep, dispatch, formState, mutate, publishState, subjects, triggerToast]);

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