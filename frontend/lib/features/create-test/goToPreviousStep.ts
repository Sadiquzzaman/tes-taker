import createTestSteps from "./createTestSteps";

const goToPreviousStep = (state: CreateTestState) => {
  const currentIndex = createTestSteps.indexOf(state.currentStep);

  if (currentIndex > 0) {
    state.currentStep = createTestSteps[currentIndex - 1];
  }
};

export default goToPreviousStep;