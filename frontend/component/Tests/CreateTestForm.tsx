"use client";

import { useRef } from "react";
import Link from "next/link";
import { createTestSteps, goToNextStep, goToPreviousStep } from "@/lib/features/createTestSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import MusicPreviousIconSVG from "../svg/MusicPreviousIconSVG";
import MusicNextIconSVG from "../svg/MusicNextIconSVG";
import CloseIconSVG from "../svg/CloseIconSvg";
import BasicInfoStep from "./Create/BasicInfoStep";
import QuestionsStep from "./Create/QuestionsStep";
import { useToast } from "../Toast/ToastContext";

const CreateTestForm = () => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const { currentStep, formState } = useAppSelector((state) => state.createTest);
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

      if (!formState.subject) {
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
              {createTestSteps.map((step) => {
                const isActive = step === currentStep;

                return (
                  <label key={step} className="flex items-center gap-2">
                    <span
                      className={`relative h-4 w-4 rounded-full border ${
                        isActive ? "border-[#49734F] bg-white" : "border-[#747775] bg-transparent"
                      }`}
                    >
                      {isActive ? (
                        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#49734F]" />
                      ) : null}
                    </span>
                    <span
                      className={`text-[16px] font-[500] leading-4 tracking-[-0.02em] ${
                        isActive ? "text-[#49734F]" : "text-[#747775]"
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
            <div className="mb-[2px]">Next</div>
            <MusicNextIconSVG />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTestForm;
