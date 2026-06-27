"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { RotatingLines } from "react-loader-spinner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import axiosReq from "@/lib/axios";
import { hydrateFromExam, resetForm } from "@/lib/features/createTestSlice";
import { useApiError } from "@/hooks/api/useApiError";
import CreateTestFooter from "./Create/CreateTestFooter";
import CreateTestStepContent from "./Create/CreateTestStepContent";
import CreateTestStepSidebar from "./Create/CreateTestStepSidebar";
import useCreateTestFlow from "./Create/useCreateTestFlow";

const CreateTestForm = () => {
  const createTestState = useAppSelector((state) => state.createTest) as CreateTestState;
  const { currentStep, formState } = createTestState;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { handleNextStep, handlePreviousStep, isFirstStep, isSubmitting } = useCreateTestFlow(createTestState);

  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId");
  const { handleError } = useApiError();
  const [hydrating, setHydrating] = useState(Boolean(examId));

  useEffect(() => {
    let active = true;

    const loadExamForEdit = async () => {
      if (!examId) {
        if (createTestState.editExamId) {
          dispatch(resetForm());
        }
        setHydrating(false);
        return;
      }

      if (createTestState.editExamId === examId) {
        setHydrating(false);
        return;
      }

      setHydrating(true);
      try {
        const response = await axiosReq.get(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}`);
        if (active) {
          dispatch(hydrateFromExam(response.data.payload));
        }
      } catch (error) {
        handleError(error as AxiosError<ApiError>);
      } finally {
        if (active) {
          setHydrating(false);
        }
      }
    };

    void loadExamForEdit();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  if (hydrating) {
    return (
      <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="rotating-lines-loading"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    );
  }

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
