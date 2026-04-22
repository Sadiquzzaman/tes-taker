import BasicInfoStep from "./BasicInfoStep";
import PublishStep from "./PublishStep";
import QuestionsStep from "./QuestionsStep";
import ReviewStep from "./ReviewStep";

type CreateTestStepContentProps = {
  currentStep: CreateTestStep;
  formState: FormState;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
};

const CreateTestStepContent = ({ currentStep, formState, scrollContainerRef }: CreateTestStepContentProps) => {
  if (currentStep === "Basic info") {
    return <BasicInfoStep formState={formState} />;
  }

  if (currentStep === "Questions") {
    return <QuestionsStep scrollContainerRef={scrollContainerRef} />;
  }

  if (currentStep === "Review") {
    return <ReviewStep />;
  }

  return <PublishStep />;
};

export default CreateTestStepContent;