import createTestSteps from "./createTestSteps";

const goToNextStep = (state: CreateTestState) => {
  const currentIndex = createTestSteps.indexOf(state.currentStep);

  if (currentIndex < createTestSteps.length - 1) {
    state.currentStep = createTestSteps[currentIndex + 1];
  }
};

export default goToNextStep;