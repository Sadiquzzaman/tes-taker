"use client";

import { useRef } from "react";
import { useAppSelector } from "@/lib/hooks";
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
    <div className="flex min-h-[calc(100vh-96px)] flex-col overflow-hidden lg:h-[calc(100vh-96px)]">
      {/* <div className="flex items-center justify-between pr-8">
        <p className="text-[32px] font-[600] leading-[32px] tracking-[-0.04em] text-[#232A25]">Create Test</p>
        <Link href="/tests">
          <CloseIconSVG />
        </Link>
      </div> */}
      <div className="mt-0 flex w-full flex-col gap-4 lg:flex-1 lg:flex-row lg:gap-8 lg:overflow-hidden">
        <CreateTestStepSidebar currentStep={currentStep} />

        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-visible lg:overflow-y-auto lg:pr-8">
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
