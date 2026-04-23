"use client";

import { useRef } from "react";
import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import CloseIconSVG from "../svg/CloseIconSvg";
import CreateTestFooter from "./Create/CreateTestFooter";
import CreateTestStepContent from "./Create/CreateTestStepContent";
import CreateTestStepSidebar from "./Create/CreateTestStepSidebar";
import useCreateTestFlow from "./Create/useCreateTestFlow";

const CreateTestForm = () => {
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const { currentStep, formState } = createTestState;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { handleNextStep, handlePreviousStep, isFirstStep, isSubmitting } = useCreateTestFlow(createTestState);

  return (
    <div className="flex h-[85vh] flex-col overflow-hidden">
      <div className="flex items-center justify-between pr-8">
        <p className="text-[32px] font-[600] leading-[32px] tracking-[-0.04em] text-[#232A25]">Create Test</p>
        <Link href="/tests">
          <CloseIconSVG />
        </Link>
      </div>
      <div className="mt-6 flex max-h-[80%] min-h-0 w-full max-w-[816px] flex-1 gap-6 overflow-hidden md:gap-8">
        <CreateTestStepSidebar currentStep={currentStep} />

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto pr-8">
          <CreateTestStepContent
            currentStep={currentStep}
            formState={formState}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      </div>
      <CreateTestFooter
        currentStep={currentStep}
        isFirstStep={isFirstStep}
        isSubmitting={isSubmitting}
        onBack={handlePreviousStep}
        onNext={handleNextStep}
      />
    </div>
  );
};

export default CreateTestForm;
