"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTestSteps,
  goToNextStep,
  goToPreviousStep,
  resetForm,
  setQuestionValidationState,
} from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import MusicPreviousIconSVG from "../svg/MusicPreviousIconSVG";
import MusicNextIconSVG from "../svg/MusicNextIconSVG";
import CloseIconSVG from "../svg/CloseIconSvg";
import BasicInfoStep from "./Create/BasicInfoStep";
import QuestionsStep from "./Create/QuestionsStep";
import { useToast } from "../Toast/ToastContext";
import BlackTickIconSVG from "../svg/BlackTickIconSVG";
import ReviewStep from "./Create/ReviewStep";
import PublishStep from "./Create/PublishStep";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { setNewTestCreated } from "@/lib/features/testSlice";
import { collectQuestionValidationFailures } from "../../utils/createTestValidation";

const CreateTestForm = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { triggerToast } = useToast();
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const { currentStep, formState, subjects, publishState } = createTestState;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressWidth = `${(createTestSteps.indexOf(currentStep) / (createTestSteps.length - 1)) * 100}%`;

  const handleNextStep = () => {
    if (currentStep === "Basic info") {
      if (!formState.examType) {
        triggerToast({
          description: "Please select an exam type",
          type: "error",
        });
        return;
      }

      if (!formState.testName.trim()) {
        triggerToast({
          description: "Please enter a test name",
          type: "error",
        });
        return;
      }

      if (formState.examType !== "model" && subjects.length === 0) {
        triggerToast({
          description: "Please select a subject",
          type: "error",
        });
        return;
      }

      if (!formState.duration) {
        triggerToast({
          description: "Please enter a duration",
          type: "error",
        });
        return;
      }

      if (formState.allowNegativeMarking && !formState.negativeMarking) {
        triggerToast({
          description: "Please enter a negative marking value",
          type: "error",
        });
        return;
      }
    } else if (currentStep === "Questions") {
      if (subjects.length === 0) {
        triggerToast({
          description: "Please add at least one subject before continuing",
          type: "error",
        });
        return;
      }

      const totalQuestions = subjects.reduce(
        (count, subject) =>
          count +
          subject.questionSections.reduce((sectionCount, section) => sectionCount + section.questions.length, 0),
        0,
      );

      if (totalQuestions === 0) {
        triggerToast({
          description: "Please add at least one question before continuing",
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
    } else if (currentStep === "Publish") {
      if (publishState.publishTiming === "schedule") {
        if (!publishState.scheduleAt || !publishState.endingAt) {
          triggerToast({
            description: "Please select the full schedule and ending date/time",
            type: "error",
          });
          return;
        }
      }

      if (publishState.testAudience === "selected_class" && !publishState.selectedClassId) {
        triggerToast({
          description: "Please select at least one class",
          type: "error",
        });
        return;
      }

      const createdTestId = `${Date.now()}`;
      const shareLink =
        typeof window !== "undefined"
          ? `${window.location.origin}/tests?createdTest=${createdTestId}`
          : `/tests?createdTest=${createdTestId}`;

      dispatch(
        setNewTestCreated({
          id: createdTestId,
          testName: formState.testName.trim(),
          shareLink,
          type: "new",
          test: { formState, subjects, publishState },
        }),
      );
      dispatch(resetForm());
      router.push("/tests");
      return;
    }

    dispatch(goToNextStep());
  };

  return (
    <div className="flex h-[85vh] flex-col overflow-hidden">
      <div className="flex items-center justify-between pr-8">
        <p className="text-[32px] font-[600] leading-[32px] tracking-[-0.04em] text-[#232A25]">Create Test</p>
        <Link href="/tests">
          <CloseIconSVG />
        </Link>
      </div>
      <div className="mt-6 flex max-h-[80%] min-h-0 w-full max-w-[816px] flex-1 gap-6 overflow-hidden md:gap-8">
        <aside className="h-full rounded-[12px] bg-[rgba(239,240,243,0.75)] p-5 md:w-[260px] md:min-w-[260px]">
          <div className="flex h-full flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">Steps</p>
                <p className="text-[14px] font-[400] leading-[125%] tracking-[-0.02em] text-[#747775]">
                  {createTestSteps.indexOf(currentStep) + 1}/{createTestSteps.length}
                </p>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-[19px] bg-[#E5E5E5]">
                <div className="h-1 rounded-[19px] bg-[#49734F]" style={{ width: progressWidth }} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {createTestSteps.map((step, index) => {
                const isActive = step === currentStep;
                const isCompleted = index < createTestSteps.indexOf(currentStep);

                return (
                  <label key={step} className="flex items-center gap-2">
                    {isCompleted ? (
                      <BlackTickIconSVG />
                    ) : (
                      <span
                        className={`relative h-4 w-4 rounded-full border ${
                          isActive ? "border-[#49734F] bg-white" : "border-[#747775] bg-transparent"
                        }`}
                      >
                        {isActive ? (
                          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#49734F]" />
                        ) : null}
                      </span>
                    )}

                    <span
                      className={`text-[16px] font-[500] leading-4 tracking-[-0.02em] ${
                        isActive ? "text-[#49734F]" : isCompleted ? "text-[#232A25]" : "text-[#747775]"
                      }`}
                    >
                      {step}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </aside>

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto pr-8">
          {currentStep === "Basic info" && <BasicInfoStep formState={formState} />}
          {currentStep === "Questions" && <QuestionsStep scrollContainerRef={scrollContainerRef} />}
          {currentStep === "Review" && <ReviewStep />}
          {currentStep === "Publish" && <PublishStep />}
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 pr-8">
        <Link
          href="/tests"
          className="flex h-9 items-center justify-center rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#232A25]"
        >
          Cancel
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => dispatch(goToPreviousStep())}
            className="flex h-9 items-center justify-center gap-1 rounded-[8px] bg-[#EFF0F3] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-[#747775]"
          >
            <MusicPreviousIconSVG />
            <div className="mb-[2px]">Back</div>
          </button>
          <button
            type="button"
            onClick={handleNextStep}
            className="flex h-9 items-center justify-center gap-1 rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] leading-4 tracking-[-0.02em] text-white"
          >
            <div className="mb-[2px]">{currentStep === "Publish" ? "Publish Test" : "Next"}</div>
            {currentStep === "Publish" ? <RightArrowIconSVG /> : <MusicNextIconSVG />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTestForm;
