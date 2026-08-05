import BasicInfoStep from "./BasicInfoStep";
import PublishStep from "./PublishStep";
import QuestionsStep from "./QuestionsStep";
import ReorderStep from "./ReorderStep";
import ReviewStep from "./ReviewStep";

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

  if (currentStep === "Reorder") {
    return <ReorderStep />;
  }

  return <PublishStep />;
};

export default CreateTestStepContent;
