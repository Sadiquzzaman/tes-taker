"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { Card, PageHeader, Skeleton } from "@/design/ui";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import axiosReq from "@/lib/axios";
import { hydrateFromExam, resetForm } from "@/lib/features/createTestSlice";
import { useApiError } from "@/hooks/api/useApiError";
import CreateTestFooter from "./Create/CreateTestFooter";
import CreateTestStepContent from "./Create/CreateTestStepContent";
import CreateTestStepSidebar from "./Create/CreateTestStepSidebar";
import useCreateTestFlow from "./Create/useCreateTestFlow";

/** The create/edit test wizard: steps on the side, the current step, and the footer. */
const CreateTestForm = () => {
  const t = useTranslations("createTest");
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
    // Safe to re-run: once the stored editExamId matches, nothing is fetched again.
  }, [createTestState.editExamId, dispatch, examId, handleError]);

  if (hydrating) {
    return (
      <div className="flex flex-col gap-6 pb-8" aria-busy="true">
        <Skeleton className="h-8 w-1/3" />
        <Card>
          <Skeleton lines={8} />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 lg:h-[calc(100dvh-7rem)]">
      <PageHeader title={examId ? t("editTitle") : t("title")} />
      <div className="flex w-full flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-6">
        <CreateTestStepSidebar currentStep={currentStep} />
        <div ref={scrollContainerRef} className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-2">
          <CreateTestStepContent currentStep={currentStep} formState={formState} scrollContainerRef={scrollContainerRef} />
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
